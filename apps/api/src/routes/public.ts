import { Router } from 'express';
import { EVENT_TYPES, LIVE_STATUSES, POSITIONS, type Position } from '@kiwanja/core';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { ah, notFound } from '../lib/http.js';
import { currentSeason, getGameRules, getScoringRules } from '../lib/settings.js';
import { currentGameweek, nextGameweek } from '../services/gameweeks.js';
import { matchState } from '../services/matchState.js';
import { aggregateOrEmpty, playerAggregates } from '../services/playerStats.js';

export const publicRouter = Router();

const clubLite = { id: true, name: true, shortName: true, primaryColor: true, secondaryColor: true, origin: true } as const;

publicRouter.get(
  '/meta',
  ah(async (_req, res) => {
    const season = await currentSeason();
    const [rules, scoring, current, next, eventTypes, sources] = await Promise.all([
      getGameRules(),
      getScoringRules(),
      currentGameweek(season.id),
      nextGameweek(season.id),
      prisma.eventType.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.dataSource.findMany({ where: { active: true }, select: { id: true, name: true, kind: true, attribution: true, url: true } }),
    ]);
    res.json({
      season: { id: season.id, name: season.name, competition: season.competition.name },
      rules,
      scoringRules: scoring,
      currentGameweek: current,
      nextGameweek: next,
      eventTypes: eventTypes.map((e) => ({ ...EVENT_TYPES.find((d) => d.code === e.code), ...e })),
      dataSources: sources,
    });
  }),
);

publicRouter.get(
  '/clubs',
  ah(async (_req, res) => {
    res.json(await prisma.club.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { players: true } } } }));
  }),
);

publicRouter.get(
  '/players',
  ah(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const position = POSITIONS.includes(req.query.position as Position) ? (req.query.position as Position) : undefined;
    const where: Prisma.PlayerWhereInput = {
      active: true,
      ...(req.query.club ? { clubId: String(req.query.club) } : {}),
      ...(position ? { position } : {}),
      ...(req.query.maxPrice ? { price: { lte: Number(req.query.maxPrice) } } : {}),
      ...(q ? { OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const players = await prisma.player.findMany({ where, include: { club: { select: clubLite } } });
    const agg = await playerAggregates(players.map((p) => p.id));
    const sort = String(req.query.sort ?? 'totalPoints');
    const rows = players.map((p) => ({ ...p, stats: aggregateOrEmpty(agg, p.id) }));
    const key = (r: (typeof rows)[number]): number => (sort === 'price' ? r.price : ((r.stats as unknown as Record<string, number>)[sort] ?? r.stats.totalPoints));
    rows.sort((a, b) => key(b) - key(a) || b.price - a.price);
    const limit = Math.min(Number(req.query.limit ?? 500), 500);
    res.json({ total: rows.length, players: rows.slice(0, limit) });
  }),
);

publicRouter.get(
  '/players/:id',
  ah(async (req, res) => {
    const player = await prisma.player.findUnique({ where: { id: req.params.id }, include: { club: true, source: { select: { name: true, kind: true } }, priceChanges: { orderBy: { createdAt: 'desc' }, take: 10 } } });
    if (!player) throw notFound('Player');
    const [agg, history, upcoming] = await Promise.all([
      playerAggregates([player.id]),
      prisma.playerFixturePoints.findMany({
        where: { playerId: player.id },
        include: { fixture: { include: { homeClub: { select: clubLite }, awayClub: { select: clubLite }, gameweek: { select: { number: true } } } } },
        orderBy: { fixture: { kickoffAt: 'desc' } },
      }),
      prisma.fixture.findMany({
        where: { status: 'SCHEDULED', OR: [{ homeClubId: player.clubId }, { awayClubId: player.clubId }] },
        include: { homeClub: { select: clubLite }, awayClub: { select: clubLite }, gameweek: { select: { number: true } } },
        orderBy: { kickoffAt: 'asc' },
        take: 5,
      }),
    ]);
    const stats = await prisma.playerMatchStat.findMany({ where: { playerId: player.id, basis: 'PROVISIONAL' } });
    const statByFixture = new Map(stats.map((s) => [s.fixtureId, s]));
    res.json({
      player,
      stats: aggregateOrEmpty(agg, player.id),
      history: history.map((h) => ({ ...h, stat: statByFixture.get(h.fixtureId) ?? null })),
      upcoming,
    });
  }),
);

publicRouter.get(
  '/gameweeks',
  ah(async (_req, res) => {
    const season = await currentSeason();
    const gws = await prisma.gameweek.findMany({ where: { seasonId: season.id }, orderBy: { number: 'asc' }, include: { _count: { select: { fixtures: true } } } });
    const stats = await prisma.fantasyGameweekScore.groupBy({ by: ['gameweekId'], _avg: { provisionalPoints: true }, _max: { provisionalPoints: true } });
    const m = new Map(stats.map((s) => [s.gameweekId, s]));
    res.json(gws.map((g) => ({ ...g, averagePoints: Math.round(m.get(g.id)?._avg.provisionalPoints ?? 0), highestPoints: m.get(g.id)?._max.provisionalPoints ?? 0 })));
  }),
);

publicRouter.get(
  '/fixtures',
  ah(async (req, res) => {
    const season = await currentSeason();
    const where: Prisma.FixtureWhereInput = { seasonId: season.id };
    if (req.query.gameweek) where.gameweek = { number: Number(req.query.gameweek) };
    if (req.query.club) where.OR = [{ homeClubId: String(req.query.club) }, { awayClubId: String(req.query.club) }];
    if (req.query.live === '1') where.status = { in: [...LIVE_STATUSES] };
    const fixtures = await prisma.fixture.findMany({
      where,
      include: { homeClub: { select: clubLite }, awayClub: { select: clubLite }, gameweek: { select: { id: true, number: true, name: true } } },
      orderBy: { kickoffAt: 'asc' },
    });
    res.json(fixtures);
  }),
);

publicRouter.get(
  '/matches/:id',
  ah(async (req, res) => {
    const state = await matchState(req.params.id);
    // Public view: hide internal assignment details.
    res.json({ ...state, assignments: undefined, events: state.events.map((e) => ({ ...e, recordedBy: undefined, verifications: e.verifications.map((v) => ({ decision: v.decision, createdAt: v.createdAt })) })) });
  }),
);

publicRouter.get(
  '/stats/leaders',
  ah(async (_req, res) => {
    const players = await prisma.player.findMany({ where: { active: true }, include: { club: { select: clubLite } } });
    const agg = await playerAggregates();
    const rows = players.map((p) => ({ id: p.id, firstName: p.firstName, lastName: p.lastName, position: p.position, price: p.price, club: p.club, origin: p.origin, stats: aggregateOrEmpty(agg, p.id) }));
    const top = (k: keyof (typeof rows)[number]['stats'], n = 10) => [...rows].filter((r) => (r.stats[k] as number) > 0).sort((a, b) => (b.stats[k] as number) - (a.stats[k] as number)).slice(0, n);
    res.json({
      points: top('totalPoints'),
      goals: top('goals'),
      assists: top('assists'),
      cleanSheets: top('cleanSheets'),
      saves: top('saves'),
      form: top('form'),
      selected: top('selectedByPct'),
      cards: [...rows].filter((r) => r.stats.yellowCards + r.stats.redCards > 0).sort((a, b) => b.stats.yellowCards + 3 * b.stats.redCards - (a.stats.yellowCards + 3 * a.stats.redCards)).slice(0, 10),
    });
  }),
);
