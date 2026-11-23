import { Router } from 'express';
import { z } from 'zod';
import { correctionSchema, eventBatchSchema, eventInputSchema, matchMinute, resolveSchema, verifySchema, type MatchStatus } from '@kiwanja/core';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { requirePermission } from '../../lib/auth.js';
import { HttpError, ah, conflict, notFound, parse } from '../../lib/http.js';
import { emit } from '../../lib/realtime.js';
import { assertAssigned, correctEvent, createEvent, resolveEvent, verifyEvent } from '../../services/events.js';
import { maybeFinishGameweek } from '../../services/gameweeks.js';
import { matchState } from '../../services/matchState.js';
import { recomputeFixture } from '../../services/scoringPipeline.js';

export const matchesRouter = Router();
matchesRouter.use(requirePermission('ops.access'));

async function fixtureWithAssignments(id: string) {
  const f = await prisma.fixture.findUnique({ where: { id }, include: { assignments: true, gameweek: true } });
  if (!f) throw notFound('Fixture');
  return f;
}

async function broadcast(fixtureId: string) {
  const state = await matchState(fixtureId);
  emit(`match:${fixtureId}`, 'match:update', state);
  emit(`ops:${fixtureId}`, 'ops:event', { change: 'match' });
  emit('live', 'fixture:update', { fixtureId, homeScore: state.fixture.homeScore, awayScore: state.fixture.awayScore, status: state.fixture.status });
  return state;
}

/** Full match state for the analyst console, including removed events. */
matchesRouter.get(
  '/:id',
  ah(async (req, res) => {
    const f = await fixtureWithAssignments(req.params.id);
    assertAssigned(req.user!, f);
    res.json(await matchState(req.params.id, { includeRemoved: true }));
  }),
);

matchesRouter.post(
  '/:id/events',
  requirePermission('events.log'),
  ah(async (req, res) => {
    const body = parse(eventInputSchema, req.body);
    const r = await createEvent(req.user!, req.params.id, body);
    res.status(r.outcome === 'created' ? 201 : 200).json(r);
  }),
);

/**
 * Offline sync. The device sends its queue; each item is applied idempotently and gets its own
 * result, so one bad event never blocks the rest of the queue.
 */
matchesRouter.post(
  '/:id/events/sync',
  requirePermission('events.log'),
  ah(async (req, res) => {
    const { events } = parse(eventBatchSchema, req.body);
    const sorted = [...events].sort((a, b) => a.clientRecordedAt.getTime() - b.clientRecordedAt.getTime());
    const results: { clientEventId: string; outcome: string; eventId?: string; error?: { code: string; message: string; details?: unknown } }[] = [];
    for (const e of sorted) {
      try {
        const r = await createEvent(req.user!, req.params.id, e);
        results.push({ clientEventId: e.clientEventId, outcome: r.outcome, eventId: r.event.id });
      } catch (err) {
        const he = err instanceof HttpError ? err : new HttpError(500, 'Unexpected error');
        results.push({ clientEventId: e.clientEventId, outcome: he.code === 'POSSIBLE_DUPLICATE' ? 'duplicate' : 'rejected', error: { code: he.code, message: he.message, details: he.details } });
      }
    }
    await prisma.syncLog.create({
      data: {
        userId: req.user!.id,
        fixtureId: req.params.id,
        deviceId: typeof req.headers['x-device-id'] === 'string' ? req.headers['x-device-id'] : null,
        received: events.length,
        created: results.filter((r) => r.outcome === 'created').length,
        duplicates: results.filter((r) => r.outcome === 'replayed' || r.outcome === 'duplicate').length,
        conflicts: results.filter((r) => r.outcome === 'rejected').length,
      },
    });
    res.json({ results });
  }),
);

matchesRouter.post(
  '/events/:eventId/verify',
  requirePermission('events.verify'),
  ah(async (req, res) => {
    const body = parse(verifySchema, req.body);
    res.json(await verifyEvent(req.user!, req.params.eventId, body.decision, body.note));
  }),
);

matchesRouter.post(
  '/events/:eventId/resolve',
  requirePermission('events.resolve'),
  ah(async (req, res) => {
    const body = parse(resolveSchema, req.body);
    res.json(await resolveEvent(req.user!, req.params.eventId, body.decision, body.note));
  }),
);

matchesRouter.post(
  '/events/:eventId/correct',
  ah(async (req, res) => {
    const body = parse(correctionSchema, req.body);
    res.json(await correctEvent(req.user!, req.params.eventId, body as never));
  }),
);

/** Complete history of one event: who recorded, verified, disputed and corrected it, and when. */
matchesRouter.get(
  '/events/:eventId/history',
  ah(async (req, res) => {
    const event = await prisma.matchEvent.findUnique({
      where: { id: req.params.eventId },
      include: {
        player: true,
        secondaryPlayer: true,
        type: true,
        recordedBy: { select: { id: true, displayName: true, role: true } },
        source: true,
        verifications: { include: { user: { select: { id: true, displayName: true, role: true } } }, orderBy: { createdAt: 'asc' } },
        corrections: { include: { user: { select: { id: true, displayName: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!event) throw notFound('Event');
    const auditTrail = await prisma.auditLog.findMany({ where: { entity: 'match_event', entityId: event.id }, include: { user: { select: { displayName: true } } }, orderBy: { createdAt: 'asc' } });
    res.json({ event, audit: auditTrail });
  }),
);

/** Pending and disputed events the current user can act on. */
matchesRouter.get(
  '/queue/verification',
  ah(async (req, res) => {
    const unrestricted = ['SUPER_ADMIN', 'COMPETITION_ADMIN', 'MATCH_SUPERVISOR'].includes(req.user!.role);
    const events = await prisma.matchEvent.findMany({
      where: { status: { in: ['PENDING', 'DISPUTED'] }, ...(unrestricted ? {} : { fixture: { assignments: { some: { userId: req.user!.id } } } }) },
      include: {
        player: { select: { firstName: true, lastName: true, shirtNumber: true } },
        secondaryPlayer: { select: { firstName: true, lastName: true, shirtNumber: true } },
        recordedBy: { select: { id: true, displayName: true } },
        fixture: { include: { homeClub: { select: { shortName: true } }, awayClub: { select: { shortName: true } } } },
        verifications: { include: { user: { select: { displayName: true } } } },
      },
      orderBy: { recordedAt: 'asc' },
    });
    res.json(events);
  }),
);

matchesRouter.post(
  '/:id/clock',
  requirePermission('matches.control'),
  ah(async (req, res) => {
    const { minute } = parse(z.object({ minute: z.number().int().min(1).max(130) }), req.body);
    const f = await fixtureWithAssignments(req.params.id);
    assertAssigned(req.user!, f);
    if (!['FIRST_HALF', 'SECOND_HALF'].includes(f.status)) throw conflict('The clock only runs during a half');
    const current = matchMinute({ status: f.status as MatchStatus, periodStartedAt: f.periodStartedAt, clockAdjustSec: f.clockAdjustSec });
    await prisma.fixture.update({ where: { id: f.id }, data: { clockAdjustSec: f.clockAdjustSec + (minute - current) * 60 } });
    await audit(req.user!.id, 'match.clock', 'fixture', f.id, { from: current, to: minute });
    await recomputeFixture(f.id);
    res.json(await broadcast(f.id));
  }),
);

/** Analysts finished: match moves from full-time to completed (awaiting publication). */
matchesRouter.post(
  '/:id/complete',
  requirePermission('matches.control'),
  ah(async (req, res) => {
    const f = await fixtureWithAssignments(req.params.id);
    assertAssigned(req.user!, f);
    if (f.status !== 'FULL_TIME') throw conflict('Record full-time first');
    await prisma.fixture.update({ where: { id: f.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    await audit(req.user!.id, 'match.complete', 'fixture', f.id);
    res.json(await broadcast(f.id));
  }),
);

/** Publish: every event must be verified. Confirmed statistics become the official record. */
matchesRouter.post(
  '/:id/publish',
  requirePermission('matches.publish'),
  ah(async (req, res) => {
    const f = await fixtureWithAssignments(req.params.id);
    if (f.status !== 'COMPLETED') throw conflict('Only completed matches can be published');
    const open = await prisma.matchEvent.count({ where: { fixtureId: f.id, status: { in: ['PENDING', 'DISPUTED'] } } });
    if (open) throw conflict(`${open} event(s) still need verification or a supervisor decision`, 'UNVERIFIED_EVENTS');
    await prisma.fixture.update({ where: { id: f.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await audit(req.user!.id, 'match.publish', 'fixture', f.id);
    await recomputeFixture(f.id);
    if (f.gameweekId) await maybeFinishGameweek(f.gameweekId);
    res.json(await broadcast(f.id));
  }),
);

matchesRouter.post(
  '/:id/unpublish',
  requirePermission('events.resolve'),
  ah(async (req, res) => {
    const f = await fixtureWithAssignments(req.params.id);
    if (f.status !== 'PUBLISHED') throw conflict('Match is not published');
    if (f.gameweek?.status === 'LOCKED') throw conflict('The gameweek is locked', 'GAMEWEEK_LOCKED');
    await prisma.fixture.update({ where: { id: f.id }, data: { status: 'COMPLETED', publishedAt: null } });
    await audit(req.user!.id, 'match.unpublish', 'fixture', f.id);
    res.json(await broadcast(f.id));
  }),
);
