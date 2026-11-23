import {
  CONFIRMED_STATUSES,
  FINISHED_STATUSES,
  LIVE_STATUSES,
  PROVISIONAL_STATUSES,
  STAT_KEYS,
  computeTeamGameweek,
  deriveMatchStats,
  matchMinute,
  scorePlayer,
  type EventStatus,
  type LineupPick,
  type MatchStatus,
  type PlayerGameweekResult,
  type Position,
  type StatEvent,
} from '@kiwanja/core';
import type { Prisma, StatBasis } from '@prisma/client';
import { prisma } from '../db.js';
import { emit } from '../lib/realtime.js';
import { getGameRules, getScoringRules } from '../lib/settings.js';

/**
 * The scoring pipeline. Runs whenever an event is created, verified, corrected or voided,
 * or when scoring rules change:
 *
 *   match_events ─► player_match_statistics (provisional + confirmed)
 *                ─► fantasy_points (per player per fixture, with explanations)
 *                ─► fantasy_gameweek_scores (per fantasy team: captain, auto-subs, hits)
 *                ─► fantasy_teams.totalPoints ─► leaderboards (computed on read)
 *
 * Every layer is recomputed from the one below, so corrections can never leave stale totals.
 */

// Serialise recomputations per key so concurrent requests cannot interleave writes.
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  locks.set(key, next);
  next.finally(() => locks.get(key) === next && locks.delete(key)).catch(() => undefined);
  return next;
}

export async function recomputeFixture(fixtureId: string, opts: { cascade?: boolean } = {}) {
  const gameweekId = await withLock(`fixture:${fixtureId}`, () => recomputeFixtureInner(fixtureId));
  if (opts.cascade !== false && gameweekId) await recomputeGameweek(gameweekId);
}

async function recomputeFixtureInner(fixtureId: string): Promise<string | null> {
  const [fixture, rules, gameRules] = await Promise.all([
    prisma.fixture.findUniqueOrThrow({ where: { id: fixtureId }, include: { squad: true, events: true } }),
    getScoringRules(),
    getGameRules(),
  ]);
  const status = fixture.status as MatchStatus;
  const started = LIVE_STATUSES.includes(status) || FINISHED_STATUSES.includes(status);
  const finished = FINISHED_STATUSES.includes(status);
  const currentMinute = matchMinute({ status, periodStartedAt: fixture.periodStartedAt, clockAdjustSec: fixture.clockAdjustSec, halfLength: gameRules.matchLength / 2 });
  const lineups = fixture.squad.map((s) => ({ playerId: s.playerId, side: s.side, position: s.position as Position, isStarter: s.isStarter }));
  const positionOf = new Map(fixture.squad.map((s) => [s.playerId, s.position as Position]));

  const toStatEvents = (statuses: EventStatus[]): StatEvent[] =>
    fixture.events
      .filter((e) => statuses.includes(e.status as EventStatus))
      .map((e) => ({ id: e.id, code: e.code, side: e.side, playerId: e.playerId, secondaryPlayerId: e.secondaryPlayerId, minute: e.minute, sequence: e.sequence }));

  const base = { lineups, started, finished, currentMinute, matchLength: gameRules.matchLength };
  const prov = deriveMatchStats({ ...base, events: toStatEvents(PROVISIONAL_STATUSES) });
  const conf = deriveMatchStats({ ...base, events: toStatEvents(CONFIRMED_STATUSES) });

  // Players that appear in events but not the registered squad still get stats (e.g. late registration).
  const playerIds = new Set([...prov.players.keys(), ...conf.players.keys()]);
  const missing = [...playerIds].filter((id) => !positionOf.has(id));
  if (missing.length) {
    for (const p of await prisma.player.findMany({ where: { id: { in: missing } }, select: { id: true, position: true } })) positionOf.set(p.id, p.position as Position);
  }

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  const pointsPayload: { playerId: string; provisional: number; confirmed: number }[] = [];
  for (const pid of playerIds) {
    const position = positionOf.get(pid) ?? 'MID';
    for (const [basis, result] of [['PROVISIONAL', prov], ['CONFIRMED', conf]] as [StatBasis, typeof prov][]) {
      const s = result.players.get(pid);
      const data = Object.fromEntries(STAT_KEYS.map((k) => [k, s?.[k] ?? 0]));
      writes.push(
        prisma.playerMatchStat.upsert({
          where: { fixtureId_playerId_basis: { fixtureId, playerId: pid, basis } },
          create: { fixtureId, playerId: pid, basis, ...data },
          update: data,
        }),
      );
    }
    const ps = prov.players.get(pid);
    const cs = conf.players.get(pid);
    const provScore = ps ? scorePlayer(ps, position, rules) : { total: 0, lines: [] };
    const confScore = cs ? scorePlayer(cs, position, rules) : { total: 0, lines: [] };
    const minutes = ps?.minutes ?? 0;
    const data = {
      gameweekId: fixture.gameweekId,
      provisionalPoints: provScore.total,
      provisionalBreakdown: provScore.lines as unknown as Prisma.InputJsonValue,
      confirmedPoints: confScore.total,
      confirmedBreakdown: confScore.lines as unknown as Prisma.InputJsonValue,
      minutes,
    };
    writes.push(prisma.playerFixturePoints.upsert({ where: { fixtureId_playerId: { fixtureId, playerId: pid } }, create: { fixtureId, playerId: pid, ...data }, update: data }));
    pointsPayload.push({ playerId: pid, provisional: provScore.total, confirmed: confScore.total });
  }
  // Remove stale rows for players no longer involved (e.g. a wrongly registered player).
  writes.push(prisma.playerMatchStat.deleteMany({ where: { fixtureId, playerId: { notIn: [...playerIds] } } }));
  writes.push(prisma.playerFixturePoints.deleteMany({ where: { fixtureId, playerId: { notIn: [...playerIds] } } }));

  for (const [basis, result] of [['PROVISIONAL', prov], ['CONFIRMED', conf]] as [StatBasis, typeof prov][]) {
    for (const side of ['HOME', 'AWAY'] as const) {
      const stats = result.teams[side] as unknown as Prisma.InputJsonValue;
      writes.push(prisma.teamMatchStat.upsert({ where: { fixtureId_side_basis: { fixtureId, side, basis } }, create: { fixtureId, side, basis, stats }, update: { stats } }));
    }
  }
  writes.push(prisma.fixture.update({ where: { id: fixtureId }, data: { homeScore: prov.score.HOME, awayScore: prov.score.AWAY } }));
  await prisma.$transaction(writes);

  emit('live', 'fixture:update', { fixtureId, homeScore: prov.score.HOME, awayScore: prov.score.AWAY, status: fixture.status });
  emit('live', 'points:update', { fixtureId, gameweekId: fixture.gameweekId, players: pointsPayload });
  return fixture.gameweekId;
}

/** Per-player gameweek results (summed over all of a player's fixtures in the gameweek). */
export async function playerGameweekResults(gameweekId: string) {
  const [fixtures, points] = await Promise.all([
    prisma.fixture.findMany({ where: { gameweekId }, select: { id: true, homeClubId: true, awayClubId: true, status: true } }),
    prisma.playerFixturePoints.findMany({ where: { gameweekId } }),
  ]);
  const clubFixtures = new Map<string, { finished: boolean }[]>();
  for (const f of fixtures) {
    const finished = FINISHED_STATUSES.includes(f.status as MatchStatus) || f.status === 'POSTPONED';
    for (const c of [f.homeClubId, f.awayClubId]) clubFixtures.set(c, [...(clubFixtures.get(c) ?? []), { finished }]);
  }
  const prov = new Map<string, { points: number; minutes: number }>();
  const conf = new Map<string, { points: number; minutes: number }>();
  for (const p of points) {
    const a = prov.get(p.playerId) ?? { points: 0, minutes: 0 };
    a.points += p.provisionalPoints;
    a.minutes += p.minutes;
    prov.set(p.playerId, a);
    const b = conf.get(p.playerId) ?? { points: 0, minutes: 0 };
    b.points += p.confirmedPoints;
    b.minutes += p.minutes;
    conf.set(p.playerId, b);
  }
  return { clubFixtures, prov, conf };
}

export async function recomputeGameweek(gameweekId: string) {
  return withLock(`gameweek:${gameweekId}`, () => recomputeGameweekInner(gameweekId));
}

async function recomputeGameweekInner(gameweekId: string) {
  const gameRules = await getGameRules();
  const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } });
  if (gw.status === 'UPCOMING') return; // nobody's line-up is frozen yet

  const [picks, transfers, { clubFixtures, prov, conf }] = await Promise.all([
    prisma.fantasyGameweekPick.findMany({ where: { gameweekId }, include: { player: { select: { clubId: true } } } }),
    prisma.fantasyTransfer.groupBy({ by: ['teamId'], where: { gameweekId }, _sum: { cost: true }, _count: true }),
    playerGameweekResults(gameweekId),
  ]);
  const hits = new Map(transfers.map((t) => [t.teamId, { cost: t._sum.cost ?? 0, count: t._count }]));
  const byTeam = new Map<string, typeof picks>();
  for (const p of picks) byTeam.set(p.teamId, [...(byTeam.get(p.teamId) ?? []), p]);

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  for (const [teamId, teamPicks] of byTeam) {
    const lineup: LineupPick[] = teamPicks.map((p) => ({ playerId: p.playerId, position: p.position as Position, slot: p.slot, isCaptain: p.isCaptain, isViceCaptain: p.isViceCaptain }));
    const results = (src: Map<string, { points: number; minutes: number }>) =>
      new Map<string, PlayerGameweekResult>(
        teamPicks.map((p) => {
          const fx = clubFixtures.get(p.player.clubId) ?? [];
          const r = src.get(p.playerId);
          return [p.playerId, { playerId: p.playerId, points: r?.points ?? 0, minutes: r?.minutes ?? 0, hasFixture: fx.length > 0, allFinished: fx.length > 0 && fx.every((f) => f.finished) }];
        }),
      );
    const provScore = computeTeamGameweek(lineup, results(prov), gameRules);
    const confScore = computeTeamGameweek(lineup, results(conf), gameRules);
    const hit = hits.get(teamId) ?? { cost: 0, count: 0 };
    const data = {
      provisionalPoints: provScore.points,
      confirmedPoints: confScore.points,
      transferCost: hit.cost,
      transfersMade: hit.count,
      breakdown: { provisional: provScore, confirmed: confScore } as unknown as Prisma.InputJsonValue,
    };
    writes.push(prisma.fantasyGameweekScore.upsert({ where: { teamId_gameweekId: { teamId, gameweekId } }, create: { teamId, gameweekId, ...data }, update: data }));
  }
  if (writes.length) await prisma.$transaction(writes);
  await refreshTeamTotals([...byTeam.keys()]);
  emit('live', 'leaderboard:update', { gameweekId });
}

/** Season totals = sum of gameweek scores minus transfer hits. */
export async function refreshTeamTotals(teamIds?: string[]) {
  const where = teamIds ? { teamId: { in: teamIds } } : {};
  const sums = await prisma.fantasyGameweekScore.groupBy({ by: ['teamId'], where, _sum: { provisionalPoints: true, confirmedPoints: true, transferCost: true } });
  await prisma.$transaction(
    sums.map((s) =>
      prisma.fantasyTeam.update({
        where: { id: s.teamId },
        data: {
          totalPoints: (s._sum.provisionalPoints ?? 0) - (s._sum.transferCost ?? 0),
          confirmedTotal: (s._sum.confirmedPoints ?? 0) - (s._sum.transferCost ?? 0),
        },
      }),
    ),
  );
}

/** Recompute everything (after a scoring-rule change). */
export async function recomputeAll() {
  const fixtures = await prisma.fixture.findMany({ where: { status: { not: 'SCHEDULED' } }, select: { id: true, gameweekId: true } });
  for (const f of fixtures) await recomputeFixture(f.id, { cascade: false });
  const gws = await prisma.gameweek.findMany({ where: { status: { not: 'UPCOMING' } }, select: { id: true } });
  for (const g of gws) await recomputeGameweek(g.id);
  return { fixtures: fixtures.length, gameweeks: gws.length };
}
