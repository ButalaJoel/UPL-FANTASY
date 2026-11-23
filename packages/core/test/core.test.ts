import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAME_RULES as R,
  DEFAULT_SCORING_RULES as RULES,
  computeTeamGameweek,
  cupWinner,
  defaultLineup,
  deriveMatchStats,
  drawCup,
  emptyStats,
  h2hStandings,
  matchMinute,
  nextFreeTransfers,
  priceChange,
  roundRobin,
  scorePlayer,
  transferCost,
  validateLineup,
  validateSquad,
  type LineupEntry,
  type LineupPick,
  type PlayerGameweekResult,
  type Position,
  type SquadPlayer,
} from '../src/index.js';

const lineups: LineupEntry[] = [
  { playerId: 'hgk', side: 'HOME', position: 'GK', isStarter: true },
  { playerId: 'hdef', side: 'HOME', position: 'DEF', isStarter: true },
  { playerId: 'hmid', side: 'HOME', position: 'MID', isStarter: true },
  { playerId: 'hfwd', side: 'HOME', position: 'FWD', isStarter: true },
  { playerId: 'hsub', side: 'HOME', position: 'FWD', isStarter: false },
  { playerId: 'agk', side: 'AWAY', position: 'GK', isStarter: true },
  { playerId: 'adef', side: 'AWAY', position: 'DEF', isStarter: true },
  { playerId: 'afwd', side: 'AWAY', position: 'FWD', isStarter: true },
];

describe('deriveMatchStats', () => {
  it('derives goals, assists, minutes, conceded and clean sheets from events', () => {
    const r = deriveMatchStats({
      lineups,
      started: true,
      finished: true,
      currentMinute: 90,
      events: [
        { id: '1', code: 'GOAL', side: 'HOME', playerId: 'hfwd', secondaryPlayerId: 'hmid', minute: 12 },
        { id: '2', code: 'SUBSTITUTION', side: 'HOME', playerId: 'hfwd', secondaryPlayerId: 'hsub', minute: 70 },
        { id: '3', code: 'OWN_GOAL', side: 'AWAY', playerId: 'adef', minute: 80 },
        { id: '4', code: 'SAVE', side: 'AWAY', playerId: 'agk', minute: 30 },
        { id: '5', code: 'YELLOW_CARD', side: 'HOME', playerId: 'hdef', minute: 40 },
        { id: '6', code: 'RED_CARD', side: 'AWAY', playerId: 'afwd', minute: 50 },
      ],
    });
    expect(r.score).toEqual({ HOME: 2, AWAY: 0 });
    const s = (id: string) => r.players.get(id)!;
    expect(s('hfwd')).toMatchObject({ goals: 1, minutes: 70, started: 1 });
    expect(s('hmid').assists).toBe(1);
    expect(s('hsub').minutes).toBe(20);
    expect(s('adef')).toMatchObject({ ownGoals: 1, goalsConceded: 2, cleanSheet: 0 });
    expect(s('agk')).toMatchObject({ saves: 1, goalsConceded: 2 });
    expect(s('hgk')).toMatchObject({ cleanSheet: 1, minutes: 90 });
    expect(s('afwd')).toMatchObject({ redCards: 1, minutes: 50, goalsConceded: 1 });
  });

  it('only counts goals conceded while the player is on the pitch', () => {
    const r = deriveMatchStats({
      lineups,
      started: true,
      finished: true,
      currentMinute: 90,
      events: [
        { id: '1', code: 'SUBSTITUTION', side: 'HOME', playerId: 'hfwd', secondaryPlayerId: 'hsub', minute: 30 },
        { id: '2', code: 'GOAL', side: 'AWAY', playerId: 'afwd', minute: 60 },
      ],
    });
    expect(r.players.get('hfwd')!.goalsConceded).toBe(0);
    expect(r.players.get('hsub')!.goalsConceded).toBe(1);
  });

  it('charges the taker a missed penalty when a penalty is saved', () => {
    const r = deriveMatchStats({ lineups, started: true, finished: false, currentMinute: 20, events: [{ id: '1', code: 'PENALTY_SAVED', side: 'AWAY', playerId: 'agk', secondaryPlayerId: 'hfwd', minute: 10 }] });
    expect(r.players.get('agk')!.penaltiesSaved).toBe(1);
    expect(r.players.get('hfwd')!.penaltiesMissed).toBe(1);
    expect(r.players.get('hfwd')!.minutes).toBe(20);
  });
});

describe('scoring engine', () => {
  const stats = (over: Partial<ReturnType<typeof emptyStats>>) => ({ ...emptyStats(), ...over });
  it('scores goals by position', () => {
    const byPos = (p: Position) => scorePlayer(stats({ minutes: 90, goals: 1 }), p, RULES).lines.find((l) => l.code === 'GOAL')!.points;
    expect([byPos('GK'), byPos('DEF'), byPos('MID'), byPos('FWD')]).toEqual([10, 6, 5, 4]);
  });
  it('awards appearance, clean sheet only at 60+ minutes, saves per 3 and conceded per 2', () => {
    expect(scorePlayer(stats({ minutes: 59, cleanSheet: 1 }), 'DEF', RULES).total).toBe(1);
    expect(scorePlayer(stats({ minutes: 60, cleanSheet: 1 }), 'DEF', RULES).total).toBe(6);
    expect(scorePlayer(stats({ minutes: 90, saves: 7, goalsConceded: 5 }), 'GK', RULES).total).toBe(2 + 2 - 2);
  });
  it('explains every point', () => {
    const r = scorePlayer(stats({ minutes: 90, goals: 2, assists: 1, yellowCards: 1, shotsOnTarget: 1 }), 'MID', RULES);
    expect(r.total).toBe(2 + 10 + 3 - 1 + 1);
    expect(r.lines.map((l) => l.code)).toEqual(['APPEARANCE_FULL', 'GOAL', 'ASSIST', 'YELLOW_CARD', 'SHOT_ON_TARGET']);
  });
  it('respects disabled and edited rules', () => {
    const edited = RULES.map((r) => (r.code === 'GOAL' ? { ...r, points: { ...r.points, FWD: 7 } } : r.code === 'SHOT_ON_TARGET' ? { ...r, enabled: false } : r));
    expect(scorePlayer(stats({ minutes: 10, goals: 1, shotsOnTarget: 3 }), 'FWD', edited).total).toBe(1 + 7);
  });
});

const mk = (id: string, position: Position, clubId: string, price = 50): SquadPlayer => ({ playerId: id, position, clubId, price });
const squad15 = (): SquadPlayer[] => [
  mk('g1', 'GK', 'a'), mk('g2', 'GK', 'b', 40),
  mk('d1', 'DEF', 'c'), mk('d2', 'DEF', 'd'), mk('d3', 'DEF', 'e'), mk('d4', 'DEF', 'f'), mk('d5', 'DEF', 'g', 40),
  mk('m1', 'MID', 'h', 90), mk('m2', 'MID', 'i', 80), mk('m3', 'MID', 'j'), mk('m4', 'MID', 'k'), mk('m5', 'MID', 'l', 45),
  mk('f1', 'FWD', 'm', 85), mk('f2', 'FWD', 'n', 70), mk('f3', 'FWD', 'o', 45),
];

describe('squad rules', () => {
  it('accepts a valid squad and rejects composition, club and budget violations', () => {
    expect(validateSquad(squad15(), R)).toEqual([]);
    const fourFromOneClub = squad15().map((p, i) => (i < 4 ? { ...p, clubId: 'x' } : p));
    expect(validateSquad(fourFromOneClub, R).map((i) => i.code)).toContain('CLUB_LIMIT');
    const pricey = squad15().map((p) => ({ ...p, price: 100 }));
    expect(validateSquad(pricey, R).map((i) => i.code)).toContain('BUDGET');
    expect(validateSquad(squad15().slice(0, 14), R).map((i) => i.code)).toContain('SIZE');
    expect(validateSquad(squad15().slice(0, 3), R, { partial: true })).toEqual([]);
  });
  it('builds a valid default line-up', () => {
    const l = defaultLineup(squad15(), R);
    expect(validateLineup(l, R)).toEqual([]);
    expect(l.find((p) => p.isCaptain)!.playerId).toBe('m1');
  });
  it('rejects illegal formations', () => {
    const l = defaultLineup(squad15(), R).map((p) => (p.playerId === 'g2' ? { ...p, slot: 11 } : p.slot === 11 ? { ...p, slot: 12 } : p));
    expect(validateLineup(l, R).map((i) => i.code)).toContain('GK');
  });
});

describe('team gameweek score', () => {
  const picks = (): LineupPick[] => defaultLineup(squad15(), R);
  const results = (over: Record<string, Partial<PlayerGameweekResult>> = {}) =>
    new Map(squad15().map((p) => [p.playerId, { playerId: p.playerId, points: 2, minutes: 90, hasFixture: true, allFinished: true, ...over[p.playerId] }]));

  it('doubles the captain', () => {
    const s = computeTeamGameweek(picks(), results({ m1: { points: 10 } }), R);
    expect(s.points).toBe(10 * 2 + 10 * 2);
    expect(s.multiplierTo).toBe('m1');
  });
  it('passes the armband to the vice-captain and auto-subs a non-player', () => {
    const s = computeTeamGameweek(picks(), results({ m1: { points: 0, minutes: 0 } }), R);
    expect(s.multiplierTo).toBe('f1');
    expect(s.autoSubs).toHaveLength(1);
    expect(s.points).toBe(9 * 2 + 2 * 2 + 2); // 9 starters, vice doubled, bench player
  });
  it('does not auto-sub while a fixture is still to be played', () => {
    const s = computeTeamGameweek(picks(), results({ m1: { points: 0, minutes: 0, allFinished: false } }), R);
    expect(s.autoSubs).toHaveLength(0);
    expect(s.multiplierTo).toBe('m1');
  });
  it('keeps a legal formation when substituting', () => {
    // With 4-4-2 a defender who did not play can only be replaced while 3+ defenders remain.
    const p = picks();
    const benchDef = p.find((x) => x.slot > 11 && x.position === 'DEF');
    const s = computeTeamGameweek(p, results({ d1: { minutes: 0, points: 0 }, d2: { minutes: 0, points: 0 } }), R);
    expect(s.autoSubs.length).toBeGreaterThan(0);
    if (benchDef) expect(s.autoSubs.map((a) => a.inId)).toContain(benchDef.playerId);
  });
});

describe('transfers, prices, clock', () => {
  it('charges hits beyond free transfers', () => {
    expect(transferCost({ count: 3, freeTransfers: 1, hitCost: 4, wildcard: false, unlimited: false })).toEqual({ cost: 8, freeUsed: 1 });
    expect(transferCost({ count: 3, freeTransfers: 1, hitCost: 4, wildcard: true, unlimited: false }).cost).toBe(0);
    expect(nextFreeTransfers(1, 0, 1, 5)).toBe(2);
    expect(nextFreeTransfers(5, 0, 1, 5)).toBe(5);
    expect(nextFreeTransfers(2, 4, 1, 5)).toBe(1);
  });
  it('changes prices with net transfers', () => {
    expect(priceChange(10, 100, R.pricing)).toBe(3);
    expect(priceChange(-3, 100, R.pricing)).toBe(-1);
    expect(priceChange(1, 100, R.pricing)).toBe(0);
  });
  it('runs the match clock', () => {
    const start = new Date('2026-01-01T15:00:00Z');
    expect(matchMinute({ status: 'FIRST_HALF', periodStartedAt: start, now: new Date('2026-01-01T15:10:30Z') })).toBe(11);
    expect(matchMinute({ status: 'SECOND_HALF', periodStartedAt: start, now: new Date('2026-01-01T15:00:05Z') })).toBe(46);
    expect(matchMinute({ status: 'HALF_TIME', periodStartedAt: start })).toBe(45);
  });
});

describe('competitions', () => {
  it('schedules every pairing once per cycle', () => {
    const rr = roundRobin(['a', 'b', 'c', 'd'], 3);
    const pairs = rr.flat().map((p) => [...p].sort().join('-'));
    expect(new Set(pairs).size).toBe(6);
    expect(roundRobin(['a', 'b', 'c'], 3).flat().some((p) => p.includes(null))).toBe(true);
  });
  it('builds H2H standings', () => {
    const t = h2hStandings(['a', 'b'], [{ teamAId: 'a', teamBId: 'b', scoreA: 50, scoreB: 40, finished: true }]);
    expect(t[0]).toMatchObject({ teamId: 'a', leaguePoints: 3, won: 1 });
  });
  it('draws cups and breaks ties', () => {
    expect(drawCup(['1', '2', '3', '4', '5'], 'SEEDED', 1)).toEqual([['1', '4'], ['2', '3']]);
    expect(drawCup(['1', '2', '3', '4'], 'RANDOM', 7).flat().sort()).toEqual(['1', '2', '3', '4']);
    expect(cupWinner({ id: 'a', score: 50, total: 100, seed: 2 }, { id: 'b', score: 50, total: 120, seed: 1 })).toBe('b');
  });
});
