import type { Position } from './football.js';
import type { GameRules } from './rules.js';
import type { LineupPick } from './squad.js';

/** One player's result for a gameweek (summed across all of their fixtures that week). */
export interface PlayerGameweekResult {
  playerId: string;
  points: number;
  minutes: number;
  /** Player has at least one fixture this gameweek. */
  hasFixture: boolean;
  /** All of the player's fixtures this gameweek have finished. */
  allFinished: boolean;
}

export interface TeamPickLine {
  playerId: string;
  position: Position;
  slot: number;
  basePoints: number;
  multiplier: number;
  points: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  /** Counted in this team's score (starter or auto-sub). */
  counted: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
}

export interface TeamGameweekScore {
  points: number;
  lines: TeamPickLine[];
  autoSubs: { outId: string; inId: string }[];
  captainId: string | null;
  /** Who actually received the captain multiplier. */
  multiplierTo: string | null;
}

/** A player "did not play" only once all their fixtures are over (or they have none) with 0 minutes. */
const didNotPlay = (r: PlayerGameweekResult | undefined) => !r || (r.minutes === 0 && (r.allFinished || !r.hasFixture));
const played = (r: PlayerGameweekResult | undefined) => !!r && r.minutes > 0;

function formationValid(starters: { position: Position }[], min: GameRules['minFormation']): boolean {
  const c: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const s of starters) c[s.position] += 1;
  return c.GK === 1 && c.DEF >= min.DEF && c.MID >= min.MID && c.FWD >= min.FWD;
}

/**
 * Compute a fantasy team's gameweek score from its picks and player results.
 * Applies automatic substitutions (bench order, formation rules, goalkeeper-for-goalkeeper)
 * and the captain / vice-captain rules.
 */
export function computeTeamGameweek(picks: LineupPick[], results: Map<string, PlayerGameweekResult>, rules: GameRules): TeamGameweekScore {
  const n = rules.squad.startersCount;
  const sorted = [...picks].sort((a, b) => a.slot - b.slot);
  let starters = sorted.filter((p) => p.slot <= n);
  const bench = sorted.filter((p) => p.slot > n);
  const autoSubs: { outId: string; inId: string }[] = [];
  const usedBench = new Set<string>();

  if (rules.autoSubs) {
    for (const s of [...starters]) {
      if (!didNotPlay(results.get(s.playerId))) continue;
      for (const b of bench) {
        if (usedBench.has(b.playerId) || !played(results.get(b.playerId))) continue;
        if ((s.position === 'GK') !== (b.position === 'GK')) continue;
        const candidate = starters.map((x) => (x.playerId === s.playerId ? b : x));
        if (!formationValid(candidate, rules.minFormation)) continue;
        starters = candidate;
        usedBench.add(b.playerId);
        autoSubs.push({ outId: s.playerId, inId: b.playerId });
        break;
      }
    }
  }

  const counted = new Set(starters.map((s) => s.playerId));
  const captain = picks.find((p) => p.isCaptain) ?? null;
  const vice = picks.find((p) => p.isViceCaptain) ?? null;
  let multiplierTo: string | null = captain?.playerId ?? null;
  if (captain && didNotPlay(results.get(captain.playerId)) && rules.captain.viceTakesOver) {
    multiplierTo = vice && !didNotPlay(results.get(vice.playerId)) && counted.has(vice.playerId) ? vice.playerId : null;
  }

  const lines: TeamPickLine[] = sorted.map((p) => {
    const base = results.get(p.playerId)?.points ?? 0;
    const isCounted = counted.has(p.playerId);
    const multiplier = !isCounted ? 0 : p.playerId === multiplierTo ? rules.captain.multiplier : 1;
    return {
      playerId: p.playerId,
      position: p.position,
      slot: p.slot,
      basePoints: base,
      multiplier,
      points: base * multiplier,
      isCaptain: p.isCaptain,
      isViceCaptain: p.isViceCaptain,
      counted: isCounted,
      subbedIn: autoSubs.some((a) => a.inId === p.playerId),
      subbedOut: autoSubs.some((a) => a.outId === p.playerId),
    };
  });

  return {
    points: lines.reduce((s, l) => s + l.points, 0),
    lines,
    autoSubs,
    captainId: captain?.playerId ?? null,
    multiplierTo,
  };
}

/** Transfer cost for a set of transfers made before a deadline. */
export function transferCost(args: { count: number; freeTransfers: number; hitCost: number; wildcard: boolean; unlimited: boolean }) {
  if (args.wildcard || args.unlimited) return { cost: 0, freeUsed: 0 };
  const freeUsed = Math.min(args.count, args.freeTransfers);
  return { cost: (args.count - freeUsed) * args.hitCost, freeUsed };
}

/** Free transfers available in the next gameweek. */
export function nextFreeTransfers(current: number, used: number, perGameweek: number, maxBanked: number): number {
  return Math.min(maxBanked, Math.max(0, current - used) + perGameweek);
}

/** Price change in tenths for one gameweek, from net transfers. */
export function priceChange(netTransfersIn: number, totalTeams: number, rules: GameRules['pricing']): number {
  if (!rules.enabled || totalTeams <= 0) return 0;
  const pct = (netTransfersIn / totalTeams) * 100;
  const steps = Math.trunc(pct / rules.thresholdPct);
  const capped = Math.max(-rules.maxChangePerGameweek, Math.min(rules.maxChangePerGameweek, steps));
  return capped * rules.step;
}
