/**
 * Football domain vocabulary shared by the data-operations app, the API and the fantasy app.
 * This is the "event dictionary": every analyst, every scoring rule and every future
 * data source (video analytics, wearables) speaks these codes.
 */

export const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

export type Side = 'HOME' | 'AWAY';
export const otherSide = (s: Side): Side => (s === 'HOME' ? 'AWAY' : 'HOME');

/** Where a record came from. Lets us keep fictional, manual and imported data apart. */
export const RECORD_ORIGINS = ['SAMPLE', 'MANUAL', 'IMPORTED', 'DEVICE', 'VIDEO'] as const;
export type RecordOrigin = (typeof RECORD_ORIGINS)[number];

export const ORIGIN_LABELS: Record<RecordOrigin, string> = {
  SAMPLE: 'Fictional sample data',
  MANUAL: 'Manually entered by our analysts',
  IMPORTED: 'Imported from an external source',
  DEVICE: 'Supplied by a tracking device',
  VIDEO: 'Proposed by video analytics',
};

export const EVENT_STATUSES = ['PENDING', 'VERIFIED', 'DISPUTED', 'REJECTED', 'VOIDED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];
/** Events that count toward provisional statistics. */
export const PROVISIONAL_STATUSES: EventStatus[] = ['PENDING', 'VERIFIED', 'DISPUTED'];
/** Events that count toward confirmed statistics. */
export const CONFIRMED_STATUSES: EventStatus[] = ['VERIFIED'];

export const MATCH_STATUSES = [
  'SCHEDULED',
  'FIRST_HALF',
  'HALF_TIME',
  'SECOND_HALF',
  'FULL_TIME',
  'COMPLETED',
  'PUBLISHED',
  'POSTPONED',
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];
export const LIVE_STATUSES: MatchStatus[] = ['FIRST_HALF', 'HALF_TIME', 'SECOND_HALF'];
export const FINISHED_STATUSES: MatchStatus[] = ['FULL_TIME', 'COMPLETED', 'PUBLISHED'];

export type EventCategory = 'PERIOD' | 'GOAL' | 'DISCIPLINE' | 'SUBSTITUTION' | 'PENALTY' | 'SHOT' | 'PASS' | 'DEFENCE' | 'GOALKEEPING' | 'OTHER';

export interface EventTypeDef {
  code: string;
  label: string;
  category: EventCategory;
  /** Whether the event must name a player. */
  needsPlayer: boolean;
  playerLabel?: string;
  /** Optional second player (assist provider, player coming on, penalty taker). */
  secondaryLabel?: string;
  secondaryRequired?: boolean;
  /** Secondary player is from the opposing team (e.g. penalty taker for a save). */
  secondaryIsOpponent?: boolean;
  /** Default: important events need a second analyst's verification. */
  requiresVerification: boolean;
  /** Shown as a big button in the first row of the logging screen. */
  primary: boolean;
  /** Not collected yet in phase 1 but supported by the model, the UI and the scoring engine. */
  extended?: boolean;
  description: string;
}

export const EVENT_TYPES: EventTypeDef[] = [
  { code: 'MATCH_START', label: 'Kick-off', category: 'PERIOD', needsPlayer: false, requiresVerification: false, primary: false, description: 'First half starts. Starts the match clock.' },
  { code: 'HALF_TIME', label: 'Half-time', category: 'PERIOD', needsPlayer: false, requiresVerification: false, primary: false, description: 'First half ends.' },
  { code: 'SECOND_HALF_START', label: 'Second half', category: 'PERIOD', needsPlayer: false, requiresVerification: false, primary: false, description: 'Second half starts.' },
  { code: 'FULL_TIME', label: 'Full-time', category: 'PERIOD', needsPlayer: false, requiresVerification: false, primary: false, description: 'Match ends.' },

  { code: 'GOAL', label: 'Goal', category: 'GOAL', needsPlayer: true, playerLabel: 'Scorer', secondaryLabel: 'Assist', requiresVerification: true, primary: true, description: 'A goal for the selected team. Optionally name the assisting player. Mark penalties in details.' },
  { code: 'OWN_GOAL', label: 'Own goal', category: 'GOAL', needsPlayer: true, playerLabel: 'Player who scored the own goal', requiresVerification: true, primary: true, description: 'Select the team of the player who put the ball in their own net. The goal is credited to the opponent.' },
  { code: 'YELLOW_CARD', label: 'Yellow card', category: 'DISCIPLINE', needsPlayer: true, requiresVerification: true, primary: true, description: 'Caution.' },
  { code: 'RED_CARD', label: 'Red card', category: 'DISCIPLINE', needsPlayer: true, requiresVerification: true, primary: true, description: 'Sending off (straight red or second yellow). The player leaves the pitch.' },
  { code: 'SUBSTITUTION', label: 'Substitution', category: 'SUBSTITUTION', needsPlayer: true, playerLabel: 'Player off', secondaryLabel: 'Player on', secondaryRequired: true, requiresVerification: true, primary: true, description: 'Player off and player on.' },
  { code: 'PENALTY_AWARDED', label: 'Penalty won', category: 'PENALTY', needsPlayer: true, playerLabel: 'Player fouled', requiresVerification: true, primary: false, description: 'A penalty awarded to the selected team. Name the player who won it.' },
  { code: 'PENALTY_MISSED', label: 'Penalty missed', category: 'PENALTY', needsPlayer: true, playerLabel: 'Taker', requiresVerification: true, primary: false, description: 'Penalty missed (off target or hit the woodwork). For a save, log Penalty saved instead.' },
  { code: 'PENALTY_SAVED', label: 'Penalty saved', category: 'PENALTY', needsPlayer: true, playerLabel: 'Goalkeeper', secondaryLabel: 'Taker', secondaryIsOpponent: true, requiresVerification: true, primary: false, description: 'Goalkeeper saves a penalty. The taker is automatically charged a missed penalty.' },
  { code: 'MAN_OF_THE_MATCH', label: 'Man of the Match', category: 'OTHER', needsPlayer: true, requiresVerification: true, primary: false, description: 'Official Man of the Match.' },

  { code: 'SAVE', label: 'Save', category: 'GOALKEEPING', needsPlayer: true, playerLabel: 'Goalkeeper', requiresVerification: false, primary: false, description: 'Goalkeeper save from a shot on target.' },
  { code: 'SHOT_ON_TARGET', label: 'Shot on target', category: 'SHOT', needsPlayer: true, requiresVerification: false, primary: false, description: 'Shot that would have gone in without a save (goals are logged separately).' },
  { code: 'SHOT_OFF_TARGET', label: 'Shot off target', category: 'SHOT', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Shot wide or over.' },
  { code: 'SHOT_BLOCKED', label: 'Blocked shot', category: 'SHOT', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Shot blocked by an outfield player.' },
  { code: 'KEY_PASS', label: 'Key pass', category: 'PASS', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Pass leading directly to a shot.' },
  { code: 'BIG_CHANCE_CREATED', label: 'Big chance created', category: 'PASS', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Pass creating a clear goal-scoring chance.' },
  { code: 'PASS_COMPLETE', label: 'Pass completed', category: 'PASS', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Successful pass.' },
  { code: 'PASS_FAILED', label: 'Pass failed', category: 'PASS', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Unsuccessful pass.' },
  { code: 'TACKLE', label: 'Tackle won', category: 'DEFENCE', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Successful tackle.' },
  { code: 'INTERCEPTION', label: 'Interception', category: 'DEFENCE', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Pass intercepted.' },
  { code: 'CLEARANCE', label: 'Clearance', category: 'DEFENCE', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Defensive clearance.' },
  { code: 'FOUL', label: 'Foul', category: 'DISCIPLINE', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Foul committed.' },
  { code: 'OFFSIDE', label: 'Offside', category: 'OTHER', needsPlayer: true, requiresVerification: false, primary: false, extended: true, description: 'Player caught offside.' },
  { code: 'CORNER', label: 'Corner', category: 'OTHER', needsPlayer: false, playerLabel: 'Taker (optional)', requiresVerification: false, primary: false, extended: true, description: 'Corner kick won by the team.' },
];

export const EVENT_TYPE_MAP: Record<string, EventTypeDef> = Object.fromEntries(EVENT_TYPES.map((e) => [e.code, e]));
export const PERIOD_EVENTS = ['MATCH_START', 'HALF_TIME', 'SECOND_HALF_START', 'FULL_TIME'];

/** Match status after a period event, or null if the event does not change the status. */
export function statusAfterPeriodEvent(code: string): MatchStatus | null {
  switch (code) {
    case 'MATCH_START':
      return 'FIRST_HALF';
    case 'HALF_TIME':
      return 'HALF_TIME';
    case 'SECOND_HALF_START':
      return 'SECOND_HALF';
    case 'FULL_TIME':
      return 'FULL_TIME';
    default:
      return null;
  }
}

/** Allowed transitions for period events, guarding against out-of-order clicks. */
export function periodEventAllowed(current: MatchStatus, code: string): boolean {
  const allowed: Record<string, MatchStatus[]> = {
    MATCH_START: ['SCHEDULED'],
    HALF_TIME: ['FIRST_HALF'],
    SECOND_HALF_START: ['HALF_TIME'],
    FULL_TIME: ['SECOND_HALF'],
  };
  return (allowed[code] ?? []).includes(current);
}

export interface ClockInput {
  status: MatchStatus;
  periodStartedAt: Date | string | null;
  clockAdjustSec?: number;
  now?: Date;
  halfLength?: number;
}

/** Live match clock. Returns the current minute (1-based, may exceed 45/90 during stoppage). */
export function matchMinute({ status, periodStartedAt, clockAdjustSec = 0, now = new Date(), halfLength = 45 }: ClockInput): number {
  if (status === 'SCHEDULED' || status === 'POSTPONED') return 0;
  if (status === 'HALF_TIME') return halfLength;
  if (FINISHED_STATUSES.includes(status)) return halfLength * 2;
  if (!periodStartedAt) return status === 'SECOND_HALF' ? halfLength + 1 : 1;
  const started = new Date(periodStartedAt).getTime();
  const elapsed = Math.max(0, Math.floor((now.getTime() - started) / 1000) + clockAdjustSec);
  const base = status === 'SECOND_HALF' ? halfLength : 0;
  return base + Math.floor(elapsed / 60) + 1;
}

export function formatMinute(minute: number, status: MatchStatus, halfLength = 45): string {
  if (status === 'FIRST_HALF' && minute > halfLength) return `${halfLength}+${minute - halfLength}'`;
  if (status === 'SECOND_HALF' && minute > halfLength * 2) return `${halfLength * 2}+${minute - halfLength * 2}'`;
  return `${minute}'`;
}
