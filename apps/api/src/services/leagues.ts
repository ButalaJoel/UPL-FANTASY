import { cupRoundName, cupSize, drawCup, h2hStandings, inviteCode } from '@kiwanja/core';
import { prisma } from '../db.js';
import { conflict, notFound } from '../lib/http.js';
import { currentSeason } from '../lib/settings.js';
import { currentGameweek } from './gameweeks.js';

const teamSelect = { id: true, name: true, totalPoints: true, confirmedTotal: true, user: { select: { id: true, displayName: true, avatarColor: true, avatarUrl: true } } } as const;

export async function uniqueCode() {
  for (;;) {
    const code = inviteCode();
    if (!(await prisma.fantasyLeague.findUnique({ where: { code } }))) return code;
  }
}

/** Classic standings: ranked by season total; also shows the current gameweek score. Always live. */
export async function classicStandings(leagueId: string | null, opts: { limit?: number; offset?: number; gameweekId?: string | null } = {}) {
  const season = await currentSeason();
  const gw = opts.gameweekId ? await prisma.gameweek.findUnique({ where: { id: opts.gameweekId } }) : await currentGameweek(season.id);
  const where = leagueId ? { leagues: { some: { leagueId } } } : { seasonId: season.id };
  const [teams, total] = await Promise.all([
    prisma.fantasyTeam.findMany({
      where,
      select: { ...teamSelect, scores: gw ? { where: { gameweekId: gw.id }, select: { provisionalPoints: true, confirmedPoints: true, transferCost: true } } : false },
      orderBy: [{ totalPoints: 'desc' }, { createdAt: 'asc' }],
      take: opts.limit ?? 50,
      skip: opts.offset ?? 0,
    }),
    prisma.fantasyTeam.count({ where }),
  ]);
  let rank = opts.offset ?? 0;
  let prevPts: number | null = null;
  let shown = rank;
  const rows = teams.map((t) => {
    rank += 1;
    if (t.totalPoints !== prevPts) shown = rank;
    prevPts = t.totalPoints;
    const s = (t as { scores?: { provisionalPoints: number; confirmedPoints: number; transferCost: number }[] }).scores?.[0];
    return {
      rank: shown,
      teamId: t.id,
      teamName: t.name,
      manager: t.user,
      totalPoints: t.totalPoints,
      confirmedTotal: t.confirmedTotal,
      gameweekPoints: s ? s.provisionalPoints - s.transferCost : 0,
      gameweekConfirmed: s ? s.confirmedPoints - s.transferCost : 0,
    };
  });
  return { gameweek: gw ? { id: gw.id, number: gw.number, status: gw.status } : null, total, rows };
}

export async function teamRank(teamId: string) {
  const team = await prisma.fantasyTeam.findUnique({ where: { id: teamId } });
  if (!team) return null;
  const ahead = await prisma.fantasyTeam.count({ where: { seasonId: team.seasonId, totalPoints: { gt: team.totalPoints } } });
  return ahead + 1;
}

/** H2H matches (scores come live from fantasy_gameweek_scores) and the resulting table. */
export async function h2hView(leagueId: string) {
  const league = await prisma.fantasyLeague.findUnique({ where: { id: leagueId }, include: { members: { include: { team: { select: teamSelect } } } } });
  if (!league) throw notFound('League');
  const matches = await prisma.headToHeadMatch.findMany({ where: { leagueId }, orderBy: [{ gameweekNumber: 'asc' }], include: { gameweek: { select: { id: true, status: true, number: true } } } });
  const gwIds = [...new Set(matches.map((m) => m.gameweekId).filter(Boolean))] as string[];
  const scores = await prisma.fantasyGameweekScore.findMany({ where: { gameweekId: { in: gwIds }, teamId: { in: league.members.map((m) => m.teamId) } } });
  const key = (t: string, g: string) => `${t}:${g}`;
  const scoreMap = new Map(scores.map((s) => [key(s.teamId, s.gameweekId), s.provisionalPoints - s.transferCost]));
  // "AVERAGE" opponent for odd leagues: the league's mean score that gameweek.
  const avg = new Map<string, number>();
  for (const g of gwIds) {
    const xs = scores.filter((s) => s.gameweekId === g).map((s) => s.provisionalPoints - s.transferCost);
    avg.set(g, xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  }
  const rows = matches.map((m) => {
    const g = m.gameweekId ?? '';
    const sa = m.teamAId ? scoreMap.get(key(m.teamAId, g)) ?? 0 : avg.get(g) ?? 0;
    const sb = m.teamBId ? scoreMap.get(key(m.teamBId, g)) ?? 0 : avg.get(g) ?? 0;
    const finished = m.gameweek?.status === 'FINISHED' || m.gameweek?.status === 'LOCKED';
    const live = m.gameweek?.status === 'LIVE';
    return { id: m.id, gameweekNumber: m.gameweekNumber, teamAId: m.teamAId, teamBId: m.teamBId, scoreA: sa, scoreB: sb, finished, live };
  });
  const table = h2hStandings(league.members.map((m) => m.teamId), rows.filter((r) => r.finished || r.live).map((r) => ({ ...r, finished: true })));
  const teams = Object.fromEntries(league.members.map((m) => [m.teamId, m.team]));
  return { league, teams, matches: rows, table };
}

/** Create a knockout cup: entrants are the top teams of a league (or overall) by season points. */
export async function createCup(input: { name: string; leagueId?: string | null; startGameweek: number; maxEntrants: number; method: 'RANDOM' | 'SEEDED' }) {
  const season = await currentSeason();
  const gw = await prisma.gameweek.findFirst({ where: { seasonId: season.id, number: input.startGameweek } });
  if (!gw) throw notFound('Start gameweek');
  if (gw.status !== 'UPCOMING') throw conflict('A cup must start in a future gameweek');
  const teams = await prisma.fantasyTeam.findMany({
    where: { seasonId: season.id, ...(input.leagueId ? { leagues: { some: { leagueId: input.leagueId } } } : {}), squad: { some: {} } },
    orderBy: [{ totalPoints: 'desc' }, { createdAt: 'asc' }],
    take: input.maxEntrants,
    select: { id: true },
  });
  if (teams.length < 2) throw conflict('At least two teams are needed for a cup');
  const size = cupSize(teams.length);
  const rounds = Math.log2(size);
  const lastGw = await prisma.gameweek.count({ where: { seasonId: season.id, number: { gte: input.startGameweek } } });
  if (lastGw < rounds) throw conflict(`Not enough gameweeks left for ${rounds} rounds`);
  const seed = Math.floor(Math.random() * 1e9);
  const ids = teams.map((t) => t.id);
  const seedOf = new Map(ids.map((id, i) => [id, i + 1]));
  const pairs = drawCup(ids, input.method, seed);
  return prisma.fantasyCup.create({
    data: {
      seasonId: season.id,
      name: input.name,
      leagueId: input.leagueId ?? null,
      startGameweek: input.startGameweek,
      maxEntrants: input.maxEntrants,
      method: input.method,
      seed,
      fixtures: { create: pairs.map(([a, b], i) => ({ round: 1, roundName: cupRoundName(size), gameweekNumber: input.startGameweek, slot: i + 1, teamAId: a, teamBId: b, seedA: seedOf.get(a), seedB: seedOf.get(b) })) },
    },
  });
}

export async function cupView(cupId: string) {
  const cup = await prisma.fantasyCup.findUnique({ where: { id: cupId }, include: { fixtures: { orderBy: [{ round: 'asc' }, { slot: 'asc' }] }, league: { select: { id: true, name: true } } } });
  if (!cup) throw notFound('Cup');
  const teamIds = [...new Set(cup.fixtures.flatMap((f) => [f.teamAId, f.teamBId]).filter(Boolean))] as string[];
  const teams = await prisma.fantasyTeam.findMany({ where: { id: { in: teamIds } }, select: teamSelect });
  const gws = await prisma.gameweek.findMany({ where: { seasonId: cup.seasonId, number: { in: [...new Set(cup.fixtures.map((f) => f.gameweekNumber))] } } });
  const gwByNum = new Map(gws.map((g) => [g.number, g]));
  const scores = await prisma.fantasyGameweekScore.findMany({ where: { teamId: { in: teamIds }, gameweekId: { in: gws.map((g) => g.id) } } });
  const live = new Map(scores.map((s) => [`${s.teamId}:${s.gameweekId}`, s.provisionalPoints - s.transferCost]));
  const fixtures = cup.fixtures.map((f) => {
    const g = gwByNum.get(f.gameweekNumber);
    const ls = (t: string | null) => (t && g ? live.get(`${t}:${g.id}`) ?? null : null);
    return { ...f, liveA: f.scoreA ?? ls(f.teamAId), liveB: f.scoreB ?? ls(f.teamBId), gameweekStatus: g?.status ?? 'UPCOMING' };
  });
  return { cup, teams: Object.fromEntries(teams.map((t) => [t.id, t])), fixtures };
}
