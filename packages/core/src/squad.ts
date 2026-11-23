import type { Position } from './football.js';
import { POSITIONS } from './football.js';
import type { GameRules } from './rules.js';
import { parseFormation } from './rules.js';

export interface SquadPlayer {
  playerId: string;
  position: Position;
  clubId: string;
  price: number;
}

export interface SquadIssue {
  code: string;
  message: string;
}

const countBy = <T>(items: T[], key: (t: T) => string) =>
  items.reduce<Record<string, number>>((acc, t) => {
    const k = key(t);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

/**
 * Validate a full (or partial, when `partial` is true) squad against the configured rules.
 * Partial mode is used while a user builds a team: it only reports rules already broken.
 */
export function validateSquad(players: SquadPlayer[], rules: GameRules, opts: { partial?: boolean; budget?: number } = {}): SquadIssue[] {
  const issues: SquadIssue[] = [];
  const { size, composition, maxPerClub } = rules.squad;
  const budget = opts.budget ?? rules.squad.budget;

  const ids = new Set<string>();
  for (const p of players) {
    if (ids.has(p.playerId)) issues.push({ code: 'DUPLICATE', message: 'The same player appears twice.' });
    ids.add(p.playerId);
  }
  if (!opts.partial && players.length !== size) issues.push({ code: 'SIZE', message: `A squad needs exactly ${size} players (you have ${players.length}).` });
  if (players.length > size) issues.push({ code: 'SIZE', message: `A squad can have at most ${size} players.` });

  const byPos = countBy(players, (p) => p.position);
  for (const pos of POSITIONS) {
    const have = byPos[pos] ?? 0;
    const need = composition[pos];
    if (have > need || (!opts.partial && have !== need)) issues.push({ code: 'POSITION', message: `You need ${need} ${pos} (you have ${have}).` });
  }

  const byClub = countBy(players, (p) => p.clubId);
  for (const [club, n] of Object.entries(byClub)) {
    if (n > maxPerClub) issues.push({ code: 'CLUB_LIMIT', message: `Maximum ${maxPerClub} players from one club (club ${club} has ${n}).` });
  }

  const cost = players.reduce((s, p) => s + p.price, 0);
  if (cost > budget) issues.push({ code: 'BUDGET', message: `Squad costs ${(cost / 10).toFixed(1)}m, over the ${(budget / 10).toFixed(1)}m budget.` });
  return issues;
}

export interface LineupPick {
  playerId: string;
  position: Position;
  /** 1..startersCount are starters, the rest is the bench in substitution priority order. */
  slot: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export function formationOf(starters: { position: Position }[]): string {
  const c = countBy(starters, (s) => s.position);
  return `${c.DEF ?? 0}-${c.MID ?? 0}-${c.FWD ?? 0}`;
}

export function validateLineup(picks: LineupPick[], rules: GameRules): SquadIssue[] {
  const issues: SquadIssue[] = [];
  const n = rules.squad.startersCount;
  const starters = picks.filter((p) => p.slot <= n);
  const bench = picks.filter((p) => p.slot > n).sort((a, b) => a.slot - b.slot);
  if (picks.length !== rules.squad.size) issues.push({ code: 'SIZE', message: `Line-up must include all ${rules.squad.size} squad players.` });
  if (new Set(picks.map((p) => p.slot)).size !== picks.length) issues.push({ code: 'SLOTS', message: 'Each player needs a unique slot.' });
  if (starters.length !== n) issues.push({ code: 'STARTERS', message: `Pick exactly ${n} starters.` });
  const gks = starters.filter((s) => s.position === 'GK').length;
  if (gks !== 1) issues.push({ code: 'GK', message: 'Exactly one goalkeeper must start.' });
  const formation = formationOf(starters);
  if (n === 11 && !rules.formations.includes(formation)) issues.push({ code: 'FORMATION', message: `Formation ${formation} is not allowed. Allowed: ${rules.formations.join(', ')}.` });
  if (bench[0] && bench[0].position !== 'GK' && picks.some((p) => p.slot > n && p.position === 'GK')) {
    issues.push({ code: 'BENCH_GK', message: 'The substitute goalkeeper must be first on the bench.' });
  }
  const caps = picks.filter((p) => p.isCaptain);
  const vices = picks.filter((p) => p.isViceCaptain);
  if (caps.length !== 1) issues.push({ code: 'CAPTAIN', message: 'Choose exactly one captain.' });
  if (vices.length !== 1) issues.push({ code: 'VICE', message: 'Choose exactly one vice-captain.' });
  if (caps[0] && vices[0] && caps[0].playerId === vices[0].playerId) issues.push({ code: 'CAPTAIN', message: 'Captain and vice-captain must be different players.' });
  if (caps[0] && caps[0].slot > n) issues.push({ code: 'CAPTAIN', message: 'The captain must be in the starting line-up.' });
  if (vices[0] && vices[0].slot > n) issues.push({ code: 'VICE', message: 'The vice-captain must be in the starting line-up.' });
  return issues;
}

/**
 * Build a default line-up from a squad: picks the first allowed formation that fits,
 * puts the second goalkeeper first on the bench, captains the most expensive starter.
 */
export function defaultLineup(squad: SquadPlayer[], rules: GameRules): LineupPick[] {
  const sorted = [...squad].sort((a, b) => b.price - a.price);
  const byPos: Record<Position, SquadPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of sorted) byPos[p.position].push(p);
  const preferred = ['4-4-2', ...rules.formations];
  let shape = parseFormation(preferred[0]);
  for (const f of preferred) {
    const s = parseFormation(f);
    if (rules.formations.includes(f) && POSITIONS.every((pos) => byPos[pos].length >= s[pos])) {
      shape = s;
      break;
    }
  }
  const starters: SquadPlayer[] = [];
  const bench: SquadPlayer[] = [];
  for (const pos of POSITIONS) {
    byPos[pos].forEach((p, i) => (i < shape[pos] ? starters : bench).push(p));
  }
  bench.sort((a, b) => (a.position === 'GK' ? -1 : b.position === 'GK' ? 1 : b.price - a.price));
  const ordered = [...starters, ...bench];
  const startersByPrice = [...starters].sort((a, b) => b.price - a.price);
  const cap = startersByPrice[0]?.playerId;
  const vice = startersByPrice[1]?.playerId;
  return ordered.map((p, i) => ({
    playerId: p.playerId,
    position: p.position,
    slot: i + 1,
    isCaptain: p.playerId === cap,
    isViceCaptain: p.playerId === vice,
  }));
}
