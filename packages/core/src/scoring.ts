import type { Position } from './football.js';
import type { PlayerStats, StatKey } from './stats.js';

/**
 * Configurable fantasy scoring engine.
 * A rule reads one statistic and awards points per position. Rules live in the database
 * (scoring_rules) and administrators can change, enable or disable any of them.
 *
 *  - PER_UNIT: points x floor(stat / unit). e.g. goals (unit 1), saves (unit 3), goals conceded (unit 2).
 *  - RANGE:    points once when min <= stat <= max. e.g. minutes 1-59, minutes 60+.
 *  - minMinutes: rule only applies if the player played at least this many minutes (clean sheets).
 */
export type RuleMode = 'PER_UNIT' | 'RANGE';

export interface ScoringRule {
  code: string;
  label: string;
  statKey: StatKey;
  mode: RuleMode;
  unit: number;
  min: number | null;
  max: number | null;
  minMinutes: number;
  points: Record<Position, number>;
  enabled: boolean;
  experimental?: boolean;
  sortOrder: number;
  description?: string;
}

export interface PointsLine {
  code: string;
  label: string;
  /** The statistic value that triggered the rule. */
  value: number;
  points: number;
}

export interface PlayerScore {
  total: number;
  lines: PointsLine[];
}

const pts = (GK: number, DEF: number, MID: number, FWD: number): Record<Position, number> => ({ GK, DEF, MID, FWD });

let order = 0;
const rule = (r: Omit<ScoringRule, 'sortOrder' | 'unit' | 'min' | 'max' | 'minMinutes' | 'enabled'> & Partial<ScoringRule>): ScoringRule => ({
  unit: 1,
  min: null,
  max: null,
  minMinutes: 0,
  enabled: true,
  sortOrder: (order += 10),
  ...r,
});

/** Prototype rules from the project brief (inspired by common FPL-style rules, not an official table). */
export const DEFAULT_SCORING_RULES: ScoringRule[] = [
  rule({ code: 'APPEARANCE_SHORT', label: 'Played 1-59 minutes', statKey: 'minutes', mode: 'RANGE', min: 1, max: 59, points: pts(1, 1, 1, 1) }),
  rule({ code: 'APPEARANCE_FULL', label: 'Played 60+ minutes', statKey: 'minutes', mode: 'RANGE', min: 60, max: null, points: pts(2, 2, 2, 2) }),
  rule({ code: 'GOAL', label: 'Goal scored', statKey: 'goals', mode: 'PER_UNIT', points: pts(10, 6, 5, 4) }),
  rule({ code: 'ASSIST', label: 'Assist', statKey: 'assists', mode: 'PER_UNIT', points: pts(3, 3, 3, 3) }),
  rule({ code: 'CLEAN_SHEET', label: 'Clean sheet', statKey: 'cleanSheet', mode: 'PER_UNIT', minMinutes: 60, points: pts(4, 4, 1, 0), description: 'No goals conceded while on the pitch, minimum 60 minutes played.' }),
  rule({ code: 'SAVES', label: 'Every 3 saves', statKey: 'saves', mode: 'PER_UNIT', unit: 3, points: pts(1, 0, 0, 0) }),
  rule({ code: 'PENALTY_SAVE', label: 'Penalty saved', statKey: 'penaltiesSaved', mode: 'PER_UNIT', points: pts(5, 5, 5, 5) }),
  rule({ code: 'GOALS_CONCEDED', label: 'Every 2 goals conceded', statKey: 'goalsConceded', mode: 'PER_UNIT', unit: 2, points: pts(-1, -1, 0, 0) }),
  rule({ code: 'YELLOW_CARD', label: 'Yellow card', statKey: 'yellowCards', mode: 'PER_UNIT', points: pts(-1, -1, -1, -1) }),
  rule({ code: 'RED_CARD', label: 'Red card', statKey: 'redCards', mode: 'PER_UNIT', points: pts(-3, -3, -3, -3) }),
  rule({ code: 'OWN_GOAL', label: 'Own goal', statKey: 'ownGoals', mode: 'PER_UNIT', points: pts(-2, -2, -2, -2) }),
  rule({ code: 'PENALTY_MISS', label: 'Penalty missed', statKey: 'penaltiesMissed', mode: 'PER_UNIT', points: pts(-2, -2, -2, -2) }),
  // Experimental rules (section 6.3). They only fire when analysts log these events.
  rule({ code: 'SHOT_ON_TARGET', label: 'Shot on target', statKey: 'shotsOnTarget', mode: 'PER_UNIT', experimental: true, points: pts(1, 1, 1, 1) }),
  rule({ code: 'KEY_PASS', label: 'Key pass', statKey: 'keyPasses', mode: 'PER_UNIT', experimental: true, points: pts(1, 1, 1, 1) }),
  rule({ code: 'TACKLE', label: 'Successful tackle', statKey: 'tackles', mode: 'PER_UNIT', experimental: true, points: pts(1, 1, 1, 1) }),
  rule({ code: 'INTERCEPTION', label: 'Interception', statKey: 'interceptions', mode: 'PER_UNIT', experimental: true, points: pts(1, 1, 1, 1) }),
  rule({ code: 'PENALTY_WON', label: 'Penalty won', statKey: 'penaltiesWon', mode: 'PER_UNIT', experimental: true, points: pts(2, 2, 2, 2) }),
  rule({ code: 'BIG_CHANCE', label: 'Big chance created', statKey: 'bigChancesCreated', mode: 'PER_UNIT', experimental: true, points: pts(1, 1, 1, 1) }),
  rule({ code: 'MAN_OF_THE_MATCH', label: 'Man of the Match', statKey: 'manOfTheMatch', mode: 'PER_UNIT', experimental: true, enabled: false, points: pts(3, 3, 3, 3) }),
];

/** Apply one rule. Returns the points (0 if not triggered). */
export function applyRule(r: ScoringRule, stats: PlayerStats, position: Position): number {
  if (!r.enabled) return 0;
  const value = stats[r.statKey] ?? 0;
  if (r.minMinutes > 0 && stats.minutes < r.minMinutes) return 0;
  const p = r.points[position] ?? 0;
  if (p === 0) return 0;
  if (r.mode === 'RANGE') {
    const okMin = r.min == null || value >= r.min;
    const okMax = r.max == null || value <= r.max;
    return okMin && okMax ? p : 0;
  }
  const unit = Math.max(1, r.unit || 1);
  return Math.floor(value / unit) * p;
}

/** Score one player's match. Every point comes with an explanation line. */
export function scorePlayer(stats: PlayerStats, position: Position, rules: ScoringRule[]): PlayerScore {
  const lines: PointsLine[] = [];
  for (const r of [...rules].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const points = applyRule(r, stats, position);
    if (points !== 0) lines.push({ code: r.code, label: r.label, value: stats[r.statKey] ?? 0, points });
  }
  return { total: lines.reduce((s, l) => s + l.points, 0), lines };
}
