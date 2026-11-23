import { Router } from 'express';
import { joinLeagueSchema, leagueCreateSchema } from '@kiwanja/core';
import { prisma } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { ah, badRequest, conflict, forbidden, notFound, parse } from '../lib/http.js';
import { currentSeason } from '../lib/settings.js';
import { myTeam } from '../services/fantasy.js';
import { nextGameweek } from '../services/gameweeks.js';
import { classicStandings, cupView, h2hView, uniqueCode } from '../services/leagues.js';

export const leaguesRouter = Router();

leaguesRouter.get(
  '/overall',
  ah(async (req, res) => {
    res.json(await classicStandings(null, { limit: Math.min(Number(req.query.limit ?? 50), 200), offset: Number(req.query.offset ?? 0), gameweekId: (req.query.gameweekId as string) || null }));
  }),
);

leaguesRouter.get(
  '/mine',
  requireAuth,
  ah(async (req, res) => {
    const team = await myTeam(req.user!.id);
    if (!team) return res.json({ leagues: [], cups: [] });
    const leagues = await prisma.fantasyLeague.findMany({ where: { members: { some: { teamId: team.id } } }, include: { _count: { select: { members: true } } }, orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] });
    const withRank = await Promise.all(
      leagues.map(async (l) => {
        if (l.type !== 'CLASSIC') return { ...l, myRank: null };
        const ahead = await prisma.fantasyTeam.count({ where: { leagues: { some: { leagueId: l.id } }, totalPoints: { gt: team.totalPoints } } });
        return { ...l, myRank: ahead + 1 };
      }),
    );
    const cups = await prisma.fantasyCup.findMany({ where: { fixtures: { some: { OR: [{ teamAId: team.id }, { teamBId: team.id }] } } } });
    res.json({ leagues: withRank, cups });
  }),
);

leaguesRouter.get(
  '/public',
  ah(async (_req, res) => {
    const season = await currentSeason();
    res.json(await prisma.fantasyLeague.findMany({ where: { seasonId: season.id, visibility: 'PUBLIC' }, include: { _count: { select: { members: true } } }, orderBy: { createdAt: 'asc' } }));
  }),
);

leaguesRouter.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(leagueCreateSchema, req.body);
    const team = await myTeam(req.user!.id);
    if (!team) throw badRequest('Create your fantasy team first');
    const season = await currentSeason();
    const next = await nextGameweek(season.id);
    // Ordinary users create private leagues; public leagues are created by administrators.
    const visibility = req.user!.role === 'FANTASY_USER' ? 'PRIVATE' : body.visibility;
    const league = await prisma.fantasyLeague.create({
      data: { seasonId: season.id, name: body.name, type: body.type, visibility, code: await uniqueCode(), ownerId: req.user!.id, startGameweek: body.startGameweek ?? next?.number ?? 1, members: { create: { teamId: team.id } } },
    });
    res.status(201).json(league);
  }),
);

leaguesRouter.post(
  '/join',
  requireAuth,
  ah(async (req, res) => {
    const { code } = parse(joinLeagueSchema, req.body);
    const team = await myTeam(req.user!.id);
    if (!team) throw badRequest('Create your fantasy team first');
    const league = await prisma.fantasyLeague.findUnique({ where: { code }, include: { _count: { select: { h2hMatches: true } } } });
    if (!league) throw notFound('League with that code');
    if (league.type === 'H2H' && league._count.h2hMatches > 0) throw conflict('This head-to-head league has already started');
    await prisma.leagueMember.create({ data: { leagueId: league.id, teamId: team.id } });
    res.json(league);
  }),
);

leaguesRouter.post(
  '/:id/join',
  requireAuth,
  ah(async (req, res) => {
    const team = await myTeam(req.user!.id);
    if (!team) throw badRequest('Create your fantasy team first');
    const league = await prisma.fantasyLeague.findUnique({ where: { id: req.params.id } });
    if (!league || league.visibility !== 'PUBLIC') throw notFound('Public league');
    await prisma.leagueMember.create({ data: { leagueId: league.id, teamId: team.id } });
    res.json(league);
  }),
);

leaguesRouter.delete(
  '/:id/membership',
  requireAuth,
  ah(async (req, res) => {
    const team = await myTeam(req.user!.id);
    const league = await prisma.fantasyLeague.findUnique({ where: { id: req.params.id } });
    if (!team || !league) throw notFound('League');
    if (league.isSystem) throw forbidden('You cannot leave the overall league');
    await prisma.leagueMember.delete({ where: { leagueId_teamId: { leagueId: league.id, teamId: team.id } } });
    res.json({ ok: true });
  }),
);

leaguesRouter.get(
  '/:id',
  ah(async (req, res) => {
    const league = await prisma.fantasyLeague.findUnique({ where: { id: req.params.id }, include: { owner: { select: { displayName: true } }, _count: { select: { members: true } } } });
    if (!league) throw notFound('League');
    if (league.type === 'H2H') return res.json({ league, h2h: await h2hView(league.id) });
    res.json({ league, standings: await classicStandings(league.isSystem ? null : league.id, { limit: 200, gameweekId: (req.query.gameweekId as string) || null }) });
  }),
);

leaguesRouter.get(
  '/cups/all',
  ah(async (_req, res) => {
    const season = await currentSeason();
    res.json(await prisma.fantasyCup.findMany({ where: { seasonId: season.id }, include: { league: { select: { name: true } }, _count: { select: { fixtures: true } } }, orderBy: { createdAt: 'desc' } }));
  }),
);

leaguesRouter.get(
  '/cups/:id',
  ah(async (req, res) => {
    res.json(await cupView(req.params.id));
  }),
);
