import {
  EVENT_TYPE_MAP,
  FINISHED_STATUSES,
  LIVE_STATUSES,
  PERIOD_EVENTS,
  UNRESTRICTED_MATCH_ROLES,
  can,
  periodEventAllowed,
  statusAfterPeriodEvent,
  type EventInput,
  type MatchStatus,
  type Side,
} from '@kiwanja/core';
import type { MatchEvent, Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import type { AuthUser } from '../lib/auth.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { emit } from '../lib/realtime.js';
import { onGameweekActivity } from './gameweeks.js';
import { matchState } from './matchState.js';
import { recomputeFixture } from './scoringPipeline.js';

/** Event codes where two near-identical records almost certainly mean a double entry. */
const DEDUP_CODES = new Set(['GOAL', 'OWN_GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'PENALTY_AWARDED', 'PENALTY_MISSED', 'PENALTY_SAVED', 'MAN_OF_THE_MATCH', ...PERIOD_EVENTS]);
const ACTIVE = ['PENDING', 'VERIFIED', 'DISPUTED'] as const;

type FixtureWithSquad = Prisma.FixtureGetPayload<{ include: { squad: true; gameweek: true; assignments: true } }>;

async function loadFixture(fixtureId: string): Promise<FixtureWithSquad> {
  const f = await prisma.fixture.findUnique({ where: { id: fixtureId }, include: { squad: true, gameweek: true, assignments: true } });
  if (!f) throw notFound('Fixture');
  return f;
}

/** Analysts may only work matches they are assigned to; supervisors and admins may work any. */
export function assertAssigned(user: AuthUser, fixture: { assignments: { userId: string }[] }) {
  if (UNRESTRICTED_MATCH_ROLES.includes(user.role)) return;
  if (!fixture.assignments.some((a) => a.userId === user.id)) throw forbidden('You are not assigned to this match');
}

function assertEditable(fixture: FixtureWithSquad) {
  if (fixture.gameweek?.status === 'LOCKED') throw conflict('This gameweek is locked. A super administrator must unlock it before data can change.', 'GAMEWEEK_LOCKED');
  if (fixture.status === 'PUBLISHED') throw conflict('This match has been published. Unpublish it before changing events.', 'MATCH_PUBLISHED');
}

/** Validate an event against the event dictionary, the match state and the registered squads. */
async function validateEvent(fixture: FixtureWithSquad, input: Pick<EventInput, 'code' | 'side' | 'playerId' | 'secondaryPlayerId' | 'minute'>) {
  const type = await prisma.eventType.findUnique({ where: { code: input.code } });
  if (!type || !type.enabled) throw badRequest(`Unknown or disabled event type ${input.code}`);
  const def = EVENT_TYPE_MAP[input.code];
  const status = fixture.status as MatchStatus;
  const isPeriod = PERIOD_EVENTS.includes(input.code);

  if (isPeriod) {
    if (!periodEventAllowed(status, input.code)) throw conflict(`Cannot record ${type.label} while the match is ${status.replace('_', ' ').toLowerCase()}`, 'INVALID_PERIOD');
    return { type, side: null as Side | null };
  }
  if (!LIVE_STATUSES.includes(status) && !FINISHED_STATUSES.includes(status)) throw conflict('Start the match (kick-off) before recording events', 'MATCH_NOT_STARTED');

  const squadSide = new Map(fixture.squad.map((s) => [s.playerId, s.side as Side]));
  let side = (input.side ?? null) as Side | null;
  if (type.needsPlayer && !input.playerId) throw badRequest(`${type.label} needs a player`);
  if (input.playerId) {
    const ps = squadSide.get(input.playerId);
    if (!ps) throw badRequest('That player is not in either registered match squad');
    if (side && side !== ps) throw badRequest('The player does not belong to the selected team');
    side = ps;
  }
  if (!side) throw badRequest('Select a team');
  if (def?.secondaryRequired && !input.secondaryPlayerId) throw badRequest(`${type.label} needs: ${def.secondaryLabel}`);
  if (input.secondaryPlayerId) {
    const ss = squadSide.get(input.secondaryPlayerId);
    if (!ss) throw badRequest('The second player is not in either registered match squad');
    if (input.secondaryPlayerId === input.playerId) throw badRequest('The two players must be different');
    const expected = def?.secondaryIsOpponent ? (side === 'HOME' ? 'AWAY' : 'HOME') : side;
    if (ss !== expected) throw badRequest(`${def?.secondaryLabel ?? 'Second player'} must be from the ${def?.secondaryIsOpponent ? 'opposing' : 'same'} team`);
  }
  return { type, side };
}

async function findDuplicate(fixtureId: string, input: Pick<EventInput, 'code' | 'playerId' | 'secondaryPlayerId' | 'minute' | 'side'>, excludeId?: string) {
  if (!DEDUP_CODES.has(input.code)) return null;
  return prisma.matchEvent.findFirst({
    where: {
      fixtureId,
      code: input.code,
      status: { in: [...ACTIVE] },
      ...(PERIOD_EVENTS.includes(input.code) ? {} : { playerId: input.playerId ?? null, minute: { gte: input.minute - 1, lte: input.minute + 1 } }),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export type CreateResult = { event: MatchEvent; outcome: 'created' | 'replayed' };

/** Record one event. Idempotent on clientEventId, so offline queues can replay safely. */
export async function createEvent(user: AuthUser, fixtureId: string, input: EventInput, origin: 'MANUAL' | 'VIDEO' | 'DEVICE' | 'IMPORTED' = 'MANUAL'): Promise<CreateResult> {
  if (!can(user.role, 'events.log')) throw forbidden();
  const existing = await prisma.matchEvent.findUnique({ where: { clientEventId: input.clientEventId } });
  if (existing) {
    if (existing.fixtureId !== fixtureId) throw conflict('Event id already used for another match', 'ID_REUSED');
    return { event: existing, outcome: 'replayed' };
  }
  const fixture = await loadFixture(fixtureId);
  assertAssigned(user, fixture);
  assertEditable(fixture);
  const { type, side } = await validateEvent(fixture, input);
  if (!input.force) {
    const dup = await findDuplicate(fixtureId, input);
    if (dup) throw conflict(`Possible duplicate: a ${type.label.toLowerCase()} for this player at ${dup.minute}' already exists`, 'POSSIBLE_DUPLICATE', { existingId: dup.id });
  }

  const autoVerified = !type.requiresVerification;
  const event = await prisma.$transaction(async (tx) => {
    const last = await tx.matchEvent.aggregate({ where: { fixtureId }, _max: { sequence: true } });
    const ev = await tx.matchEvent.create({
      data: {
        fixtureId,
        clientEventId: input.clientEventId,
        sequence: (last._max.sequence ?? 0) + 1,
        code: input.code,
        side,
        playerId: input.playerId ?? null,
        secondaryPlayerId: input.secondaryPlayerId ?? null,
        minute: input.minute,
        details: (input.details ?? undefined) as Prisma.InputJsonValue,
        status: autoVerified ? 'VERIFIED' : 'PENDING',
        verifiedAt: autoVerified ? new Date() : null,
        origin,
        recordedById: user.id,
        clientRecordedAt: input.clientRecordedAt,
      },
    });
    if (autoVerified) await tx.eventVerification.create({ data: { eventId: ev.id, decision: 'AUTO', note: 'Event type does not require a second analyst' } });
    const next = statusAfterPeriodEvent(input.code);
    if (next) {
      const now = new Date();
      await tx.fixture.update({
        where: { id: fixtureId },
        data: {
          status: next,
          periodStartedAt: next === 'FIRST_HALF' || next === 'SECOND_HALF' ? input.clientRecordedAt ?? now : undefined,
          clockAdjustSec: next === 'FIRST_HALF' || next === 'SECOND_HALF' ? 0 : undefined,
          startedAt: next === 'FIRST_HALF' ? now : undefined,
          finishedAt: next === 'FULL_TIME' ? now : undefined,
        },
      });
    }
    await audit(user.id, 'event.create', 'match_event', ev.id, { fixtureId, code: ev.code, minute: ev.minute, playerId: ev.playerId }, tx);
    return ev;
  });

  if (input.code === 'MATCH_START' || input.code === 'FULL_TIME') await onGameweekActivity(fixture.gameweekId);
  await afterChange(fixtureId, event, 'created');
  await notifyOwners(event);
  return { event, outcome: 'created' };
}

/** Second analyst confirms or disputes an event recorded by someone else. */
export async function verifyEvent(user: AuthUser, eventId: string, decision: 'CONFIRM' | 'DISPUTE', note?: string) {
  if (!can(user.role, 'events.verify')) throw forbidden();
  const event = await prisma.matchEvent.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Event');
  const fixture = await loadFixture(event.fixtureId);
  assertAssigned(user, fixture);
  assertEditable(fixture);
  if (event.recordedById === user.id) throw forbidden('An event must be verified by a different analyst from the one who recorded it');
  if (event.status !== 'PENDING') throw conflict(`Only pending events can be verified (this one is ${event.status.toLowerCase()})`, 'NOT_PENDING');
  if (decision === 'DISPUTE' && !note) throw badRequest('Explain why the event is disputed');

  const updated = await prisma.$transaction(async (tx) => {
    const ev = await tx.matchEvent.update({
      where: { id: eventId },
      data: { status: decision === 'CONFIRM' ? 'VERIFIED' : 'DISPUTED', verifiedAt: decision === 'CONFIRM' ? new Date() : null },
    });
    await tx.eventVerification.create({ data: { eventId, userId: user.id, decision, note } });
    await audit(user.id, `event.${decision.toLowerCase()}`, 'match_event', eventId, { note }, tx);
    return ev;
  });
  await afterChange(event.fixtureId, updated, decision === 'CONFIRM' ? 'verified' : 'disputed');
  if (decision === 'CONFIRM') await notifyOwners(updated, true);
  return updated;
}

/** Supervisor decision on a disputed (or any) event. */
export async function resolveEvent(user: AuthUser, eventId: string, decision: 'VERIFY' | 'REJECT' | 'VOID', note: string) {
  if (!can(user.role, 'events.resolve')) throw forbidden();
  const event = await prisma.matchEvent.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Event');
  const fixture = await loadFixture(event.fixtureId);
  assertEditable(fixture);
  const status = decision === 'VERIFY' ? 'VERIFIED' : decision === 'REJECT' ? 'REJECTED' : 'VOIDED';
  const updated = await prisma.$transaction(async (tx) => {
    const ev = await tx.matchEvent.update({ where: { id: eventId }, data: { status, verifiedAt: status === 'VERIFIED' ? new Date() : null, version: { increment: 1 } } });
    await tx.eventVerification.create({ data: { eventId, userId: user.id, decision: `RESOLVE_${decision}`, note } });
    await audit(user.id, `event.resolve.${decision.toLowerCase()}`, 'match_event', eventId, { note, from: event.status }, tx);
    if (PERIOD_EVENTS.includes(event.code) && status !== 'VERIFIED') await rebuildMatchStatus(tx, event.fixtureId);
    return ev;
  });
  await afterChange(event.fixtureId, updated, decision === 'VERIFY' ? 'verified' : 'removed');
  return updated;
}

/** Correct an event. Optimistic locking on `version` resolves conflicting edits from two devices. */
export async function correctEvent(user: AuthUser, eventId: string, body: { expectedVersion: number; changes: Partial<EventInput>; reason: string }) {
  const event = await prisma.matchEvent.findUnique({ where: { id: eventId } });
  if (!event) throw notFound('Event');
  const fixture = await loadFixture(event.fixtureId);
  assertEditable(fixture);
  const supervisor = can(user.role, 'events.resolve');
  const ownPending = event.recordedById === user.id && event.status === 'PENDING' && can(user.role, 'events.log');
  if (!supervisor && !ownPending) throw forbidden('Only a supervisor can correct verified or other analysts\' events. Analysts may correct their own pending events.');
  if (!supervisor) assertAssigned(user, fixture);
  if (event.version !== body.expectedVersion) {
    throw conflict('This event was changed by someone else. Review the latest version and try again.', 'VERSION_CONFLICT', { current: event });
  }
  if (['REJECTED', 'VOIDED'].includes(event.status)) throw conflict('Removed events cannot be corrected', 'REMOVED');
  if (PERIOD_EVENTS.includes(event.code) && body.changes.code && body.changes.code !== event.code) throw badRequest('Period events cannot change type');

  const merged = {
    code: body.changes.code ?? event.code,
    side: (body.changes.side !== undefined ? body.changes.side : event.side) as Side | null,
    playerId: body.changes.playerId !== undefined ? body.changes.playerId : event.playerId,
    secondaryPlayerId: body.changes.secondaryPlayerId !== undefined ? body.changes.secondaryPlayerId : event.secondaryPlayerId,
    minute: body.changes.minute ?? event.minute,
  };
  // Changing the player re-derives the side from the squad.
  if (body.changes.playerId !== undefined && body.changes.side === undefined) merged.side = null;
  const { type, side } = PERIOD_EVENTS.includes(merged.code)
    ? { type: await prisma.eventType.findUniqueOrThrow({ where: { code: merged.code } }), side: null }
    : await validateEvent(fixture, merged);
  const dup = await findDuplicate(event.fixtureId, { ...merged, side }, event.id);
  if (dup) throw conflict('This correction would duplicate an existing event', 'POSSIBLE_DUPLICATE', { existingId: dup.id });

  const before = { code: event.code, side: event.side, playerId: event.playerId, secondaryPlayerId: event.secondaryPlayerId, minute: event.minute, details: event.details, status: event.status };
  // A correction by an analyst sends important events back for verification.
  const needsReverify = type.requiresVerification && !supervisor;
  const updated = await prisma.$transaction(async (tx) => {
    const ev = await tx.matchEvent.update({
      where: { id: eventId, version: body.expectedVersion },
      data: {
        code: merged.code,
        side,
        playerId: merged.playerId,
        secondaryPlayerId: merged.secondaryPlayerId,
        minute: merged.minute,
        details: (body.changes.details ?? event.details ?? undefined) as Prisma.InputJsonValue,
        version: { increment: 1 },
        status: needsReverify ? 'PENDING' : event.status === 'DISPUTED' ? 'VERIFIED' : event.status,
        verifiedAt: needsReverify ? null : event.verifiedAt ?? new Date(),
      },
    });
    const after = { code: ev.code, side: ev.side, playerId: ev.playerId, secondaryPlayerId: ev.secondaryPlayerId, minute: ev.minute, details: ev.details, status: ev.status };
    await tx.eventCorrection.create({
      data: { eventId, userId: user.id, before: before as Prisma.InputJsonValue, after: after as Prisma.InputJsonValue, reason: body.reason, versionFrom: event.version, versionTo: ev.version },
    });
    await audit(user.id, 'event.correct', 'match_event', eventId, { reason: body.reason, before, after }, tx);
    return ev;
  });
  await afterChange(event.fixtureId, updated, 'corrected');
  return updated;
}

/** Rebuild fixture status from remaining period events (after one is voided). */
async function rebuildMatchStatus(tx: Prisma.TransactionClient, fixtureId: string) {
  const periods = await tx.matchEvent.findMany({ where: { fixtureId, code: { in: PERIOD_EVENTS }, status: { in: ['VERIFIED', 'PENDING'] } }, orderBy: { sequence: 'asc' } });
  let status: MatchStatus = 'SCHEDULED';
  let periodStartedAt: Date | null = null;
  for (const p of periods) {
    status = statusAfterPeriodEvent(p.code) ?? status;
    if (p.code === 'MATCH_START' || p.code === 'SECOND_HALF_START') periodStartedAt = p.clientRecordedAt;
  }
  await tx.fixture.update({ where: { id: fixtureId }, data: { status, periodStartedAt, finishedAt: status === 'FULL_TIME' ? undefined : null } });
}

async function afterChange(fixtureId: string, event: MatchEvent, change: string) {
  await recomputeFixture(fixtureId);
  const state = await matchState(fixtureId);
  emit(`match:${fixtureId}`, 'match:update', state);
  emit(`ops:${fixtureId}`, 'ops:event', { change, event });
  emit('live', 'fixture:update', { fixtureId, homeScore: state.fixture.homeScore, awayScore: state.fixture.awayScore, status: state.fixture.status });
}

/** Tell fantasy managers when a player they own is involved in a key event. */
async function notifyOwners(event: MatchEvent, confirmed = false) {
  if (!['GOAL', 'RED_CARD', 'PENALTY_SAVED', 'OWN_GOAL'].includes(event.code)) return;
  const fixture = await prisma.fixture.findUnique({ where: { id: event.fixtureId }, select: { gameweekId: true } });
  if (!fixture?.gameweekId) return;
  const involved = [event.playerId, event.code === 'GOAL' ? event.secondaryPlayerId : null].filter(Boolean) as string[];
  if (!involved.length) return;
  const picks = await prisma.fantasyGameweekPick.findMany({
    where: { gameweekId: fixture.gameweekId, playerId: { in: involved } },
    include: { team: { include: { user: { select: { id: true, notifyGoals: true } } } }, player: { select: { firstName: true, lastName: true } } },
  });
  const label = EVENT_TYPE_MAP[event.code]?.label ?? event.code;
  const data = picks
    .filter((p) => p.team.user.notifyGoals)
    .map((p) => {
      const assist = event.code === 'GOAL' && p.playerId === event.secondaryPlayerId;
      const name = `${p.player.firstName} ${p.player.lastName}`;
      return {
        userId: p.team.user.id,
        type: confirmed ? 'EVENT_CONFIRMED' : 'EVENT',
        title: `${name}: ${assist ? 'Assist' : label} ${event.minute}'${confirmed ? ' (confirmed)' : ''}`,
        body: confirmed ? 'Verified by our second analyst. Points are now confirmed.' : 'Provisional points added. They will be confirmed after verification.',
        link: `/match/${event.fixtureId}`,
      };
    });
  if (!data.length) return;
  await prisma.notification.createMany({ data });
  for (const n of data) emit(`user:${n.userId}`, 'notification', n);
}

