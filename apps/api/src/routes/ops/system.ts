import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { dataSourceSchema, userAdminSchema } from '@kiwanja/core';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { requirePermission } from '../../lib/auth.js';
import { ah, forbidden, parse, toCsv } from '../../lib/http.js';
import { currentSeason } from '../../lib/settings.js';
import { currentGameweek } from '../../services/gameweeks.js';

export const systemRouter = Router();

/** Operations overview: every number comes from the database. */
systemRouter.get(
  '/overview',
  requirePermission('ops.access'),
  ah(async (_req, res) => {
    const season = await currentSeason();
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [gw, clubs, players, fixtures, live, pending, disputed, teams, users, events24, recent, analysts] = await Promise.all([
      currentGameweek(season.id),
      prisma.club.count(),
      prisma.player.count({ where: { active: true } }),
      prisma.fixture.groupBy({ by: ['status'], _count: true }),
      prisma.fixture.findMany({ where: { status: { in: ['FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'FULL_TIME', 'COMPLETED'] } }, include: { homeClub: true, awayClub: true, _count: { select: { events: { where: { status: 'PENDING' } } } } }, orderBy: { kickoffAt: 'asc' } }),
      prisma.matchEvent.count({ where: { status: 'PENDING' } }),
      prisma.matchEvent.count({ where: { status: 'DISPUTED' } }),
      prisma.fantasyTeam.count(),
      prisma.user.count(),
      prisma.matchEvent.count({ where: { recordedAt: { gte: since } } }),
      prisma.auditLog.findMany({ take: 15, orderBy: { createdAt: 'desc' }, include: { user: { select: { displayName: true } } } }),
      prisma.matchEvent.groupBy({ by: ['recordedById'], where: { recordedAt: { gte: since } }, _count: true }),
    ]);
    const names = await prisma.user.findMany({ where: { id: { in: analysts.map((a) => a.recordedById) } }, select: { id: true, displayName: true } });
    res.json({
      gameweek: gw,
      counts: { clubs, players, teams, users, pending, disputed, events24 },
      fixturesByStatus: Object.fromEntries(fixtures.map((f) => [f.status, f._count])),
      activeMatches: live,
      recent,
      analystActivity: analysts.map((a) => ({ userId: a.recordedById, name: names.find((n) => n.id === a.recordedById)?.displayName ?? '?', events: a._count })),
    });
  }),
);

// ----- users -----
systemRouter.get(
  '/users',
  requirePermission('ops.access'),
  ah(async (req, res) => {
    const staffOnly = req.query.staff === '1';
    if (!staffOnly && req.user!.role !== 'SUPER_ADMIN') throw forbidden();
    const q = String(req.query.q ?? '');
    res.json(
      await prisma.user.findMany({
        where: { ...(staffOnly ? { role: { not: 'FANTASY_USER' } } : {}), ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }] } : {}) },
        select: { id: true, email: true, displayName: true, role: true, active: true, createdAt: true, lastLoginAt: true, isSample: true, _count: { select: { eventsRecorded: true, verifications: true, assignments: true } } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        take: 300,
      }),
    );
  }),
);

systemRouter.patch(
  '/users/:id',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    const body = parse(userAdminSchema, req.body);
    if (req.params.id === req.user!.id && (body.role || body.active === false)) throw forbidden('You cannot change your own role or deactivate yourself');
    const u = await prisma.user.update({ where: { id: req.params.id }, data: body, select: { id: true, email: true, role: true, active: true } });
    await audit(req.user!.id, 'user.admin.update', 'user', u.id, body);
    res.json(u);
  }),
);

// ----- data sources -----
systemRouter.get(
  '/data-sources',
  requirePermission('ops.access'),
  ah(async (_req, res) => {
    const rows = await prisma.dataSource.findMany({ include: { _count: { select: { events: true, fixtures: true, players: true, metrics: true } } }, orderBy: { createdAt: 'asc' } });
    res.json(rows.map(({ apiKeyHash, ...r }) => ({ ...r, hasApiKey: !!apiKeyHash })));
  }),
);
systemRouter.post(
  '/data-sources',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const ds = await prisma.dataSource.create({ data: parse(dataSourceSchema, req.body) });
    await audit(req.user!.id, 'datasource.create', 'data_source', ds.id, ds);
    res.status(201).json(ds);
  }),
);
systemRouter.put(
  '/data-sources/:id',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const ds = await prisma.dataSource.update({ where: { id: req.params.id }, data: parse(dataSourceSchema, req.body) });
    await audit(req.user!.id, 'datasource.update', 'data_source', ds.id, req.body);
    res.json({ ...ds, apiKeyHash: undefined });
  }),
);
/** Issue an API key for a device / partner source. Shown once. */
systemRouter.post(
  '/data-sources/:id/api-key',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const key = `kw_${randomBytes(24).toString('hex')}`;
    await prisma.dataSource.update({ where: { id: req.params.id }, data: { apiKeyHash: createHash('sha256').update(key).digest('hex') } });
    await audit(req.user!.id, 'datasource.apikey', 'data_source', req.params.id);
    res.json({ apiKey: key });
  }),
);

// ----- event types -----
systemRouter.patch(
  '/event-types/:code',
  requirePermission('settings.manage'),
  ah(async (req, res) => {
    const body = parse(z.object({ enabled: z.boolean().optional(), requiresVerification: z.boolean().optional() }), req.body);
    const t = await prisma.eventType.update({ where: { code: req.params.code }, data: body });
    await audit(req.user!.id, 'eventtype.update', 'event_type', t.code, body);
    res.json(t);
  }),
);

// ----- audit -----
systemRouter.get(
  '/audit',
  requirePermission('audit.view'),
  ah(async (req, res) => {
    res.json(
      await prisma.auditLog.findMany({
        where: { ...(req.query.entity ? { entity: String(req.query.entity) } : {}), ...(req.query.entityId ? { entityId: String(req.query.entityId) } : {}), ...(req.query.userId ? { userId: String(req.query.userId) } : {}) },
        include: { user: { select: { displayName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Number(req.query.limit ?? 200), 1000),
      }),
    );
  }),
);

systemRouter.get(
  '/sync-log',
  requirePermission('audit.view'),
  ah(async (_req, res) => {
    res.json(await prisma.syncLog.findMany({ include: { user: { select: { displayName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }));
  }),
);

// ----- exports -----
const sendCsv = (res: import('express').Response, name: string, rows: Record<string, unknown>[]) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(toCsv(rows));
};

systemRouter.get(
  '/export/events',
  requirePermission('data.export'),
  ah(async (req, res) => {
    const events = await prisma.matchEvent.findMany({
      where: req.query.fixtureId ? { fixtureId: String(req.query.fixtureId) } : {},
      include: { player: true, secondaryPlayer: true, recordedBy: { select: { displayName: true } }, fixture: { include: { homeClub: true, awayClub: true } }, source: true },
      orderBy: [{ fixture: { kickoffAt: 'asc' } }, { sequence: 'asc' }],
    });
    sendCsv(
      res,
      'match-events',
      events.map((e) => ({
        event_id: e.id,
        fixture_id: e.fixtureId,
        match: `${e.fixture.homeClub.shortName} v ${e.fixture.awayClub.shortName}`,
        kickoff: e.fixture.kickoffAt,
        sequence: e.sequence,
        minute: e.minute,
        event: e.code,
        team: e.side,
        player: e.player ? `${e.player.firstName} ${e.player.lastName}` : '',
        second_player: e.secondaryPlayer ? `${e.secondaryPlayer.firstName} ${e.secondaryPlayer.lastName}` : '',
        status: e.status,
        origin: e.origin,
        source: e.source?.name ?? '',
        recorded_by: e.recordedBy.displayName,
        recorded_at: e.recordedAt,
        device_time: e.clientRecordedAt,
        version: e.version,
      })),
    );
  }),
);

systemRouter.get(
  '/export/player-stats',
  requirePermission('data.export'),
  ah(async (req, res) => {
    const basis = req.query.basis === 'PROVISIONAL' ? 'PROVISIONAL' : 'CONFIRMED';
    const rows = await prisma.playerMatchStat.findMany({ where: { basis, ...(req.query.fixtureId ? { fixtureId: String(req.query.fixtureId) } : {}) }, include: { player: { include: { club: true } }, fixture: { include: { homeClub: true, awayClub: true } } } });
    sendCsv(
      res,
      `player-stats-${basis.toLowerCase()}`,
      rows.map(({ player, fixture, id: _id, updatedAt: _u, ...s }) => ({ player: `${player.firstName} ${player.lastName}`, club: player.club.shortName, position: player.position, player_origin: player.origin, match: `${fixture.homeClub.shortName} v ${fixture.awayClub.shortName}`, kickoff: fixture.kickoffAt, ...s })),
    );
  }),
);
