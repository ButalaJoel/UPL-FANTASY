/** Fantasy competition helpers: head-to-head schedules, standings and knockout cups. */

/** Deterministic PRNG so draws are reproducible from a stored seed. */
export function seededRandom(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Round-robin schedule (circle method). With an odd number of teams one team per round
 * plays "AVERAGE" (null), i.e. the league's average score that gameweek.
 * Returns one array of pairings per round; repeats cycles to fill `rounds`.
 */
export function roundRobin(teamIds: string[], rounds: number): [string | null, string | null][][] {
  const ids: (string | null)[] = [...teamIds];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  if (n < 2) return [];
  const cycle: [string | null, string | null][][] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string | null, string | null][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    cycle.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  return Array.from({ length: rounds }, (_, i) => cycle[i % cycle.length]);
}

export type H2HOutcome = 'W' | 'D' | 'L';
export const h2hOutcome = (a: number, b: number): H2HOutcome => (a > b ? 'W' : a < b ? 'L' : 'D');
export const H2H_POINTS: Record<H2HOutcome, number> = { W: 3, D: 1, L: 0 };

export interface H2HRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  leaguePoints: number;
}

export function h2hStandings(teamIds: string[], matches: { teamAId: string | null; teamBId: string | null; scoreA: number; scoreB: number; finished: boolean }[]): H2HRow[] {
  const rows = new Map<string, H2HRow>(teamIds.map((id) => [id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, leaguePoints: 0 }]));
  const apply = (id: string | null, f: number, a: number) => {
    const row = id ? rows.get(id) : undefined;
    if (!row) return;
    const o = h2hOutcome(f, a);
    row.played += 1;
    row.pointsFor += f;
    row.pointsAgainst += a;
    if (o === 'W') row.won += 1;
    else if (o === 'D') row.drawn += 1;
    else row.lost += 1;
    row.leaguePoints += H2H_POINTS[o];
  };
  for (const m of matches) {
    if (!m.finished) continue;
    apply(m.teamAId, m.scoreA, m.scoreB);
    apply(m.teamBId, m.scoreB, m.scoreA);
  }
  return [...rows.values()].sort((a, b) => b.leaguePoints - a.leaguePoints || b.pointsFor - a.pointsFor);
}

export function cupRoundName(teamsInRound: number): string {
  switch (teamsInRound) {
    case 2:
      return 'Final';
    case 4:
      return 'Semi-finals';
    case 8:
      return 'Quarter-finals';
    default:
      return `Round of ${teamsInRound}`;
  }
}

/** Largest power of two not above n (minimum 2). */
export const cupSize = (n: number) => Math.max(2, 2 ** Math.floor(Math.log2(Math.max(2, n))));

/**
 * First-round draw. `seededIds` must be ordered best first.
 * SEEDED: 1 v N, 2 v N-1 ... RANDOM: shuffled with the given seed.
 */
export function drawCup(seededIds: string[], method: 'RANDOM' | 'SEEDED', seed: number): [string, string][] {
  const size = cupSize(seededIds.length);
  const entrants = seededIds.slice(0, size);
  if (method === 'SEEDED') {
    return Array.from({ length: size / 2 }, (_, i) => [entrants[i], entrants[size - 1 - i]] as [string, string]);
  }
  const s = shuffle(entrants, seededRandom(seed));
  return Array.from({ length: size / 2 }, (_, i) => [s[2 * i], s[2 * i + 1]] as [string, string]);
}

/** Cup tie winner: higher gameweek score, then higher season total, then the lower seed number. */
export function cupWinner(a: { id: string; score: number; total: number; seed: number }, b: { id: string; score: number; total: number; seed: number }): string {
  if (a.score !== b.score) return a.score > b.score ? a.id : b.id;
  if (a.total !== b.total) return a.total > b.total ? a.id : b.id;
  return a.seed <= b.seed ? a.id : b.id;
}

export function inviteCode(rand: () => number = Math.random, length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[Math.floor(rand() * alphabet.length)]).join('');
}
