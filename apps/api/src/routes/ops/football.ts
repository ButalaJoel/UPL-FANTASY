import { Router } from 'express';
import { assignmentSchema, clubSchema, fixtureSchema, gameweekSchema, lineupSchema, playerSchema } from '@kiwanja/core';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { requirePermission } from '../../lib/auth.js';
import { ah, badRequest, conflict, notFound, parse } from '../../lib/http.js';
import { currentSeason } from '../../lib/settings.js';
import { lockGameweek, startGameweek, unlockGameweek } from '../../services/gameweeks.js';
import { recomputeFixture } from '../../services/scoringPipeline.js';

export const footballRouter = Router();
const manage = requirePermission('football.manage');

// ----- clubs -----
footballRouter.post(
  '/clubs',
  manage,
  ah(async (req, res) => {
    const club = await prisma.club.create({ data: parse(clubSchema, req.body) });
    await audit(req.user!.id, 'club.create', 'club', club.id, club);
    res.status(201).json(club);
  }),
);
footballRouter.put(
  '/clubs/:id',
  manage,
  ah(async (req, res) => {
    const club = await prisma.club.update({ where: { id: req.params.id }, data: parse(clubSchema, req.body) });
    await audit(req.user!.id, 'club.update', 'club', club.id, club);
    res.json(club);
  }),
);
footballRouter.delete(
  '/clubs/:id',
  manage,
  ah(async (req, res) => {
    await prisma.club.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, 'club.delete', 'club', req.params.id);
    res.json({ ok: true });
  }),
);

// ----- players -----
footballRouter.get(
  '/players',
  requirePermission('ops.access'),
  ah(async (req, res) => {
    const where: Prisma.PlayerWhereInput = {};
    if (req.query.club) where.clubId = String(req.query.club);
    if (req.query.q) where.OR = [{ firstName: { contains: String(req.query.q), mode: 'insensitive' } }, { lastName: { contains: String(req.query.q), mode: 'insensitive' } }];
    res.json(await prisma.player.findMany({ where, include: { club: { select: { id: true, shortName: true, name: true, primaryColor: true } } }, orderBy: [{ club: { name: 'asc' } }, { position: 'asc' }, { shirtNumber: 'asc' }] }));
  }),
);
footballRouter.post(
  '/players',
  manage,
  ah(async (req, res) => {
    const p = await prisma.player.create({ data: parse(playerSchema, req.body) });
    await audit(req.user!.id, 'player.create', 'player', p.id, p);
    res.status(201).json(p);
  }),
);
footballRouter.put(
  '/players/:id',
  manage,
  ah(async (req, res) => {
    const body = parse(playerSchema.partial(), req.body);
    const before = await prisma.player.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('Player');
    const active = typeof req.body.active === 'boolean' ? req.body.active : undefined;
    const p = await prisma.player.update({ where: { id: req.params.id }, data: { ...body, active } });
    if (body.price != null && body.price !== before.price) await prisma.playerPriceChange.create({ data: { playerId: p.id, oldPrice: before.price, newPrice: p.price, reason: `Manual change by ${req.user!.displayName}` } });
    await audit(req.user!.id, 'player.update', 'player', p.id, { before, after: p });
    res.json(p);
  }),
);

// ----- competitions / gameweeks -----
footballRouter.get(
  '/competitions',
  requirePermission('ops.access'),
  ah(async (_req, res) => {
    res.json(await prisma.competition.findMany({ include: { seasons: true } }));
  }),
);

footballRouter.post(
  '/gameweeks',
  requirePermission('fantasy.manage'),
  ah(async (req, res) => {
    const body = parse(gameweekSchema, req.body);
    const season = await currentSeason();
    const gw = await prisma.gameweek.create({ data: { seasonId: season.id, number: body.number, name: body.name ?? `Gameweek ${body.number}`, deadlineAt: body.deadlineAt } });
    await audit(req.user!.id, 'gameweek.create', 'gameweek', gw.id, gw);
    res.status(201).json(gw);
  }),
);
footballRouter.put(
  '/gameweeks/:id',
  requirePermission('fantasy.manage'),
  ah(async (req, res) => {
    const body = parse(gameweekSchema.partial(), req.body);
    const gw = await prisma.gameweek.update({ where: { id: req.params.id }, data: body });
    await audit(req.user!.id, 'gameweek.update', 'gameweek', gw.id, body);
    res.json(gw);
  }),
);
footballRouter.post(
  '/gameweeks/:id/start',
  requirePermission('fantasy.manage'),
  ah(async (req, res) => {
    await startGameweek(req.params.id, req.user!.id);
    res.json({ ok: true });
  }),
);
footballRouter.post(
  '/gameweeks/:id/lock',
  requirePermission('fantasy.manage'),
  ah(async (req, res) => {
    await lockGameweek(req.params.id, req.user!.id);
    res.json({ ok: true });
  }),
);
footballRouter.post(
  '/gameweeks/:id/unlock',
  requirePermission('users.manage'),
  ah(async (req, res) => {
    await unlockGameweek(req.params.id, req.user!.id);
    res.json({ ok: true });
  }),
);

// ----- fixtures -----
footballRouter.get(
  '/fixtures',
  requirePermission('ops.access'),
  ah(async (req, res) => {
    const where: Prisma.FixtureWhereInput = {};
    if (req.query.gameweek) where.gameweek = { number: Number(req.query.gameweek) };
    if (req.query.status) where.status = String(req.query.status) as never;
    if (req.query.mine === '1') where.assignments = { some: { userId: req.user!.id } };
    res.json(
      await prisma.fixture.findMany({
        where,
        include: {
          homeClub: true,
          awayClub: true,
          gameweek: { select: { id: true, number: true, status: true } },
          assignments: { include: { user: { select: { id: true, displayName: true } } } },
          _count: { select: { squad: true, events: true } },
        },
        orderBy: { kickoffAt: 'asc' },
      }),
    );
  }),
);
footballRouter.post(
  '/fixtures',
  manage,
  ah(async (req, res) => {
    const body = parse(fixtureSchema, req.body);
    if (body.homeClubId === body.awayClubId) throw badRequest('A club cannot play itself');
    const season = await currentSeason();
    const f = await prisma.fixture.create({ data: { ...body, seasonId: season.id } });
    await audit(req.user!.id, 'fixture.create', 'fixture', f.id, body);
    res.status(201).json(f);
  }),
);
footballRouter.put(
  '/fixtures/:id',
  manage,
  ah(async (req, res) => {
    const body = parse(fixtureSchema.partial(), req.body);
    const existing = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound('Fixture');
    const postponed = req.body.postponed === true ? { status: 'POSTPONED' as const } : req.body.postponed === false && existing.status === 'POSTPONED' ? { status: 'SCHEDULED' as const } : {};
    if (existing.status !== 'SCHEDULED' && existing.status !== 'POSTPONED' && (body.homeClubId || body.awayClubId)) throw conflict('Clubs cannot change after kick-off');
    const f = await prisma.fixture.update({ where: { id: req.params.id }, data: { ...body, ...postponed } });
    await audit(req.user!.id, 'fixture.update', 'fixture', f.id, req.body);
    res.json(f);
  }),
);
footballRouter.delete(
  '/fixtures/:id',
  manage,
  ah(async (req, res) => {
    const f = await prisma.fixture.findUnique({ where: { id: req.params.id }, include: { _count: { select: { events: true } } } });
    if (!f) throw notFound('Fixture');
    if (f._count.events) throw conflict('Fixtures with recorded events cannot be deleted. Postpone it instead.');
    await prisma.fixture.delete({ where: { id: f.id } });
    await audit(req.user!.id, 'fixture.delete', 'fixture', f.id);
    res.json({ ok: true });
  }),
);

/** Register a team's match squad: starting XI, substitutes and shirt numbers. */
footballRouter.put(
  '/fixtures/:id/lineup',
  manage,
  ah(async (req, res) => {
    const body = parse(lineupSchema, req.body);
    const f = await prisma.fixture.findUnique({ where: { id: req.params.id } });
    if (!f) throw notFound('Fixture');
    if (['PUBLISHED'].includes(f.status)) throw conflict('Published matches cannot change');
    const clubId = body.side === 'HOME' ? f.homeClubId : f.awayClubId;
    const players = await prisma.player.findMany({ where: { id: { in: body.players.map((p) => p.playerId) } } });
    if (players.length !== body.players.length) throw badRequest('Unknown player in line-up');
    if (players.some((p) => p.clubId !== clubId)) throw badRequest('Every player must belong to this club');
    const starters = body.players.filter((p) => p.isStarter);
    if (starters.length > 11) throw badRequest('At most 11 starters');
    const posOf = new Map(players.map((p) => [p.id, p.position]));
    if (starters.length === 11 && starters.filter((s) => (s.position ?? posOf.get(s.playerId)) === 'GK').length !== 1) throw badRequest('The starting XI needs exactly one goalkeeper');
    const numbers = body.players.map((p) => p.shirtNumber ?? players.find((x) => x.id === p.playerId)!.shirtNumber).filter((n) => n != null);
    if (new Set(numbers).size !== numbers.length) throw badRequest('Shirt numbers must be unique within a squad');
    if (f.status !== 'SCHEDULED') {
      const used = await prisma.matchEvent.findMany({ where: { fixtureId: f.id, side: body.side, status: { in: ['PENDING', 'VERIFIED', 'DISPUTED'] } }, select: { playerId: true, secondaryPlayerId: true } });
      const keep = new Set(body.players.map((p) => p.playerId));
      if (used.some((e) => (e.playerId && !keep.has(e.playerId)) || (e.secondaryPlayerId && !keep.has(e.secondaryPlayerId)))) throw conflict('A player with recorded events cannot be removed from the squad');
    }
    await prisma.$transaction([
      prisma.matchSquadEntry.deleteMany({ where: { fixtureId: f.id, side: body.side } }),
      prisma.matchSquadEntry.createMany({
        data: body.players.map((p) => ({ fixtureId: f.id, playerId: p.playerId, side: body.side, isStarter: p.isStarter, shirtNumber: p.shirtNumber ?? players.find((x) => x.id === p.playerId)!.shirtNumber, position: p.position ?? posOf.get(p.playerId)! })),
      }),
    ]);
    await audit(req.user!.id, 'fixture.lineup', 'fixture', f.id, { side: body.side, starters: starters.length, total: body.players.length });
    if (f.status !== 'SCHEDULED') await recomputeFixture(f.id);
    res.json({ ok: true });
  }),
);

footballRouter.post(
  '/fixtures/:id/assignments',
  manage,
  ah(async (req, res) => {
    const body = parse(assignmentSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user || user.role === 'FANTASY_USER') throw badRequest('Only staff accounts can be assigned to matches');
    const a = await prisma.analystAssignment.upsert({ where: { fixtureId_userId: { fixtureId: req.params.id, userId: body.userId } }, create: { fixtureId: req.params.id, ...body }, update: { role: body.role } });
    await audit(req.user!.id, 'fixture.assign', 'fixture', req.params.id, body);
    res.json(a);
  }),
);
footballRouter.delete(
  '/fixtures/:id/assignments/:userId',
  manage,
  ah(async (req, res) => {
    await prisma.analystAssignment.delete({ where: { fixtureId_userId: { fixtureId: req.params.id, userId: req.params.userId } } });
    await audit(req.user!.id, 'fixture.unassign', 'fixture', req.params.id, { userId: req.params.userId });
    res.json({ ok: true });
  }),
);
