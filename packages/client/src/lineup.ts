/**
 * Pure team-editing logic used by the "Pick team", "Create team" and "Transfers" screens
 * on web and mobile. No React, no network: easy to test and identical on every client.
 */
import { formationOf, parseFormation, validateLineup, validateSquad, type GameRules, type Position } from '@kiwanja/core';
import type { LineupDraft, Player, SquadEntry } from './types';

// ---------------------------------------------------------------------------------------
// Pick team (starting XI, bench order, armbands)

export const draftFromSquad = (squad: SquadEntry[]): LineupDraft[] =>
  squad.map((s) => ({ playerId: s.playerId, position: s.player.position, slot: s.slot, isCaptain: s.isCaptain, isViceCaptain: s.isViceCaptain, player: s.player, nextOpponent: s.nextOpponent }));

const fingerprint = (d: LineupDraft[]) => JSON.stringify([...d].sort((a, b) => a.slot - b.slot).map((x) => [x.playerId, x.slot, x.isCaptain, x.isViceCaptain]));
export const lineupChanged = (a: LineupDraft[], b: LineupDraft[]) => fingerprint(a) !== fingerprint(b);
export const lineupPayload = (d: LineupDraft[]) => d.map(({ playerId, slot, isCaptain, isViceCaptain }) => ({ playerId, slot, isCaptain, isViceCaptain }));
export const lineupIssues = (d: LineupDraft[], rules: GameRules) => validateLineup(d, rules);
export const currentFormation = (d: LineupDraft[], rules: GameRules) => formationOf(d.filter((x) => x.slot <= rules.squad.startersCount));
export const starters = (d: LineupDraft[], rules: GameRules) => [...d].filter((x) => x.slot <= rules.squad.startersCount).sort((a, b) => a.slot - b.slot);
export const bench = (d: LineupDraft[], rules: GameRules) => [...d].filter((x) => x.slot > rules.squad.startersCount).sort((a, b) => a.slot - b.slot);

/** Give the armbands to starters if either moved to the bench. */
function ensureArmbands(next: LineupDraft[], n: number): LineupDraft[] {
  const out = next.map((d) => ({ ...d, isCaptain: d.slot <= n && d.isCaptain, isViceCaptain: d.slot <= n && d.isViceCaptain }));
  const xi = out.filter((d) => d.slot <= n).sort((a, b) => b.player.price - a.player.price);
  if (!out.some((d) => d.isCaptain)) {
    const c = xi.find((d) => !d.isViceCaptain);
    if (c) c.isCaptain = true;
  }
  if (!out.some((d) => d.isViceCaptain)) {
    const v = xi.find((d) => !d.isCaptain);
    if (v) v.isViceCaptain = true;
  }
  return out;
}

/** Can these two players change places without breaking formation or goalkeeper rules? */
export function canSwap(draft: LineupDraft[], a: string, b: string, rules: GameRules): boolean {
  if (a === b) return false;
  const n = rules.squad.startersCount;
  const pa = draft.find((d) => d.playerId === a);
  const pb = draft.find((d) => d.playerId === b);
  if (!pa || !pb) return false;
  // Both on the bench: reorder outfield substitutes only (the bench goalkeeper stays first).
  if (pa.slot > n && pb.slot > n) return pa.position !== 'GK' && pb.position !== 'GK';
  // Both starting: swapping positions changes nothing.
  if (pa.slot <= n && pb.slot <= n) return false;
  const test = draft.map((d) => (d.playerId === a ? { ...d, slot: pb.slot } : d.playerId === b ? { ...d, slot: pa.slot } : d));
  return !validateLineup(
    test.map((d) => ({ ...d, isCaptain: false, isViceCaptain: false })),
    rules,
  ).some((i) => i.code === 'FORMATION' || i.code === 'GK');
}

export function swap(draft: LineupDraft[], a: string, b: string, rules: GameRules): LineupDraft[] {
  if (!canSwap(draft, a, b, rules)) return draft;
  const pa = draft.find((d) => d.playerId === a)!;
  const pb = draft.find((d) => d.playerId === b)!;
  const next = draft.map((d) => (d.playerId === a ? { ...d, slot: pb.slot } : d.playerId === b ? { ...d, slot: pa.slot } : d));
  return ensureArmbands(next, rules.squad.startersCount);
}

export function makeCaptain(draft: LineupDraft[], playerId: string): LineupDraft[] {
  const target = draft.find((d) => d.playerId === playerId);
  if (!target || target.isCaptain) return draft;
  const oldCaptain = draft.find((d) => d.isCaptain)?.playerId;
  // If the new captain was vice-captain, the old captain takes the vice armband.
  return draft.map((d) => ({
    ...d,
    isCaptain: d.playerId === playerId,
    isViceCaptain: target.isViceCaptain ? d.playerId === oldCaptain : d.isViceCaptain,
  }));
}

export function makeViceCaptain(draft: LineupDraft[], playerId: string): LineupDraft[] {
  const target = draft.find((d) => d.playerId === playerId);
  if (!target || target.isViceCaptain) return draft;
  const oldVice = draft.find((d) => d.isViceCaptain)?.playerId;
  // If the captain becomes vice, the old vice-captain takes the captaincy.
  return draft.map((d) => ({
    ...d,
    isViceCaptain: d.playerId === playerId,
    isCaptain: target.isCaptain ? d.playerId === oldVice : d.isCaptain,
  }));
}

/** Rearrange the XI into a formation, keeping the most valuable current starters. */
export function applyFormation(draft: LineupDraft[], formation: string, rules: GameRules): LineupDraft[] {
  const n = rules.squad.startersCount;
  const shape = parseFormation(formation);
  const ordered = [...draft].sort((a, b) => (a.slot <= n ? 0 : 1) - (b.slot <= n ? 0 : 1) || b.player.price - a.player.price);
  const xi: LineupDraft[] = [];
  for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as Position[]) xi.push(...ordered.filter((d) => d.position === pos).slice(0, shape[pos]));
  if (xi.length !== n) return draft; // not enough players for that shape
  const rest = draft
    .filter((d) => !xi.includes(d))
    .sort((a, b) => (a.position === 'GK' ? -1 : b.position === 'GK' ? 1 : a.slot - b.slot));
  return ensureArmbands(
    [...xi, ...rest].map((d, i) => ({ ...d, slot: i + 1 })),
    n,
  );
}

// ---------------------------------------------------------------------------------------
// Squad building (create team) and transfers

export type MiniPlayer = Pick<Player, 'id' | 'position' | 'clubId' | 'price' | 'status'>;

export const squadSpend = (picked: MiniPlayer[]) => picked.reduce((s, p) => s + p.price, 0);
export const squadIssues = (picked: MiniPlayer[], rules: GameRules, partial = true) =>
  validateSquad(
    picked.map((p) => ({ playerId: p.id, position: p.position, clubId: p.clubId, price: p.price })),
    rules,
    { partial },
  );
export const squadComplete = (picked: MiniPlayer[], rules: GameRules) => picked.length === rules.squad.size && squadIssues(picked, rules, false).length === 0;

/** Why a player can't be added to the squad being built, or null if they can. */
export function addBlocker(picked: MiniPlayer[], p: MiniPlayer, rules: GameRules): string | null {
  if (picked.some((x) => x.id === p.id)) return 'Selected';
  if (picked.filter((x) => x.position === p.position).length >= rules.squad.composition[p.position]) return `${p.position} full`;
  if (picked.filter((x) => x.clubId === p.clubId).length >= rules.squad.maxPerClub) return `${rules.squad.maxPerClub} from club`;
  if (p.price > rules.squad.budget - squadSpend(picked)) return 'Too expensive';
  return null;
}

/** Fill the empty places with affordable, available players (random but always valid). */
export function autoFill<T extends MiniPlayer>(picked: T[], pool: T[], rules: GameRules, random: () => number = Math.random): T[] {
  const cheapest = Math.min(...pool.map((p) => p.price));
  const shuffled = pool.filter((p) => p.status === 'AVAILABLE').map((p) => [random(), p] as const).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
  const next = [...picked];
  for (const pos of ['GK', 'FWD', 'MID', 'DEF'] as Position[]) {
    for (const p of shuffled) {
      if (rules.squad.composition[pos] - next.filter((x) => x.position === pos).length <= 0) break;
      if (p.position !== pos || next.some((x) => x.id === p.id)) continue;
      if (next.filter((x) => x.clubId === p.clubId).length >= rules.squad.maxPerClub) continue;
      const remainingAfter = rules.squad.size - next.length - 1;
      if (rules.squad.budget - squadSpend(next) - p.price < remainingAfter * cheapest) continue;
      next.push(p);
    }
  }
  return next;
}

export interface PendingTransfer<P extends MiniPlayer = Player> {
  out: P;
  in: P;
}

/** Squad and bank as they would be after the pending transfers. */
export function squadAfter<P extends MiniPlayer>(squad: P[], pending: PendingTransfer<P>[], bank: number) {
  const outIds = new Set(pending.map((t) => t.out.id));
  return {
    players: [...squad.filter((p) => !outIds.has(p.id)), ...pending.map((t) => t.in)],
    bank: bank + pending.reduce((s, t) => s + t.out.price - t.in.price, 0),
  };
}

/** Why `candidate` can't replace `out`, or null if the swap is allowed. */
export function buyBlocker<P extends MiniPlayer>(current: P[], bank: number, out: P, candidate: P, rules: GameRules): string | null {
  if (candidate.position !== out.position) return 'Wrong position';
  if (current.some((x) => x.id === candidate.id)) return 'In squad';
  if (current.filter((x) => x.clubId === candidate.clubId && x.id !== out.id).length >= rules.squad.maxPerClub) return `${rules.squad.maxPerClub} from club`;
  if (candidate.price > bank + out.price) return 'Too expensive';
  return null;
}
