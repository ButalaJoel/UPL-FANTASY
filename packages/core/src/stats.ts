import type { Position, Side } from './football.js';
import { otherSide } from './football.js';

/**
 * Player statistics derived from individual match events.
 * Nothing is ever "added to a total": stats are always recomputed from the event log,
 * so corrections and re-verification simply re-run this function.
 */
export const STAT_KEYS = [
  'minutes',
  'started',
  'goals',
  'assists',
  'ownGoals',
  'goalsConceded',
  'cleanSheet',
  'yellowCards',
  'redCards',
  'penaltiesWon',
  'penaltiesMissed',
  'penaltiesSaved',
  'saves',
  'shotsOnTarget',
  'shotsOffTarget',
  'shotsBlocked',
  'keyPasses',
  'bigChancesCreated',
  'passesCompleted',
  'passesFailed',
  'tackles',
  'interceptions',
  'clearances',
  'fouls',
  'offsides',
  'corners',
  'manOfTheMatch',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type PlayerStats = Record<StatKey, number>;

export const STAT_LABELS: Record<StatKey, string> = {
  minutes: 'Minutes played',
  started: 'Started',
  goals: 'Goals',
  assists: 'Assists',
  ownGoals: 'Own goals',
  goalsConceded: 'Goals conceded (on pitch)',
  cleanSheet: 'Clean sheet',
  yellowCards: 'Yellow cards',
  redCards: 'Red cards',
  penaltiesWon: 'Penalties won',
  penaltiesMissed: 'Penalties missed',
  penaltiesSaved: 'Penalties saved',
  saves: 'Saves',
  shotsOnTarget: 'Shots on target',
  shotsOffTarget: 'Shots off target',
  shotsBlocked: 'Shots blocked',
  keyPasses: 'Key passes',
  bigChancesCreated: 'Big chances created',
  passesCompleted: 'Passes completed',
  passesFailed: 'Passes failed',
  tackles: 'Tackles won',
  interceptions: 'Interceptions',
  clearances: 'Clearances',
  fouls: 'Fouls committed',
  offsides: 'Offsides',
  corners: 'Corners taken',
  manOfTheMatch: 'Man of the Match',
};

export const emptyStats = (): PlayerStats => Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as PlayerStats;

/** Simple counting events: event code -> stat incremented for the primary player. */
const COUNTING: Record<string, StatKey> = {
  YELLOW_CARD: 'yellowCards',
  RED_CARD: 'redCards',
  PENALTY_AWARDED: 'penaltiesWon',
  PENALTY_MISSED: 'penaltiesMissed',
  PENALTY_SAVED: 'penaltiesSaved',
  SAVE: 'saves',
  SHOT_ON_TARGET: 'shotsOnTarget',
  SHOT_OFF_TARGET: 'shotsOffTarget',
  SHOT_BLOCKED: 'shotsBlocked',
  KEY_PASS: 'keyPasses',
  BIG_CHANCE_CREATED: 'bigChancesCreated',
  PASS_COMPLETE: 'passesCompleted',
  PASS_FAILED: 'passesFailed',
  TACKLE: 'tackles',
  INTERCEPTION: 'interceptions',
  CLEARANCE: 'clearances',
  FOUL: 'fouls',
  OFFSIDE: 'offsides',
  CORNER: 'corners',
  MAN_OF_THE_MATCH: 'manOfTheMatch',
  OWN_GOAL: 'ownGoals',
};

export interface LineupEntry {
  playerId: string;
  side: Side;
  position: Position;
  isStarter: boolean;
}

export interface StatEvent {
  id: string;
  code: string;
  side: Side | null;
  playerId?: string | null;
  secondaryPlayerId?: string | null;
  minute: number;
  /** Tie-breaker for events in the same minute (recorded order). */
  sequence?: number;
}

export interface DeriveInput {
  lineups: LineupEntry[];
  events: StatEvent[];
  /** Has the match kicked off? */
  started: boolean;
  /** Has the final whistle gone? */
  finished: boolean;
  /** Current minute for live matches. */
  currentMinute: number;
  matchLength?: number;
}

export interface TeamStats {
  goals: number;
  shotsOnTarget: number;
  shotsOffTarget: number;
  shotsBlocked: number;
  corners: number;
  fouls: number;
  offsides: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  passesCompleted: number;
  passesFailed: number;
  tackles: number;
  interceptions: number;
}

export interface DeriveResult {
  players: Map<string, PlayerStats>;
  score: Record<Side, number>;
  teams: Record<Side, TeamStats>;
}

const emptyTeam = (): TeamStats => ({
  goals: 0,
  shotsOnTarget: 0,
  shotsOffTarget: 0,
  shotsBlocked: 0,
  corners: 0,
  fouls: 0,
  offsides: 0,
  yellowCards: 0,
  redCards: 0,
  saves: 0,
  passesCompleted: 0,
  passesFailed: 0,
  tackles: 0,
  interceptions: 0,
});

export function sortEvents<T extends StatEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => a.minute - b.minute || (a.sequence ?? 0) - (b.sequence ?? 0));
}

/** Recompute every player's and team's statistics for one match from its event log. */
export function deriveMatchStats(input: DeriveInput): DeriveResult {
  const matchLength = input.matchLength ?? 90;
  const players = new Map<string, PlayerStats>();
  const sideOf = new Map<string, Side>();
  const onAt = new Map<string, number>();
  const offAt = new Map<string, number>();
  const onPitch: Record<Side, Set<string>> = { HOME: new Set(), AWAY: new Set() };
  const score: Record<Side, number> = { HOME: 0, AWAY: 0 };
  const teams: Record<Side, TeamStats> = { HOME: emptyTeam(), AWAY: emptyTeam() };

  const stat = (playerId: string) => {
    let s = players.get(playerId);
    if (!s) {
      s = emptyStats();
      players.set(playerId, s);
    }
    return s;
  };

  for (const l of input.lineups) {
    stat(l.playerId);
    sideOf.set(l.playerId, l.side);
    if (l.isStarter && input.started) {
      onAt.set(l.playerId, 0);
      onPitch[l.side].add(l.playerId);
      stat(l.playerId).started = 1;
    }
  }

  const concede = (side: Side) => {
    for (const pid of onPitch[side]) stat(pid).goalsConceded += 1;
  };
  const takeOff = (pid: string, minute: number) => {
    const side = sideOf.get(pid);
    if (side && onPitch[side].has(pid)) {
      onPitch[side].delete(pid);
      offAt.set(pid, minute);
    }
  };

  for (const e of sortEvents(input.events)) {
    const side = e.side ?? (e.playerId ? sideOf.get(e.playerId) ?? null : null);
    const pid = e.playerId ?? null;
    switch (e.code) {
      case 'GOAL': {
        if (!side) break;
        score[side] += 1;
        teams[side].goals += 1;
        if (pid) stat(pid).goals += 1;
        if (e.secondaryPlayerId) stat(e.secondaryPlayerId).assists += 1;
        concede(otherSide(side));
        break;
      }
      case 'OWN_GOAL': {
        if (!side) break;
        const benefiting = otherSide(side);
        score[benefiting] += 1;
        teams[benefiting].goals += 1;
        if (pid) stat(pid).ownGoals += 1;
        concede(side);
        break;
      }
      case 'SUBSTITUTION': {
        if (pid) takeOff(pid, e.minute);
        const on = e.secondaryPlayerId;
        if (on) {
          const onSide = sideOf.get(on) ?? side;
          if (onSide && !onPitch[onSide].has(on) && !offAt.has(on)) {
            onPitch[onSide].add(on);
            onAt.set(on, e.minute);
            sideOf.set(on, onSide);
          }
        }
        break;
      }
      case 'PENALTY_SAVED': {
        if (pid) stat(pid).penaltiesSaved += 1;
        if (e.secondaryPlayerId) stat(e.secondaryPlayerId).penaltiesMissed += 1;
        if (side) teams[side].saves += 1;
        break;
      }
      default: {
        const key = COUNTING[e.code];
        if (!key) break;
        if (pid) stat(pid)[key] += 1;
        if (e.code === 'RED_CARD' && pid) takeOff(pid, e.minute);
        if (side) {
          const t = teams[side];
          if (e.code === 'SHOT_ON_TARGET') t.shotsOnTarget += 1;
          if (e.code === 'SHOT_OFF_TARGET') t.shotsOffTarget += 1;
          if (e.code === 'SHOT_BLOCKED') t.shotsBlocked += 1;
          if (e.code === 'CORNER') t.corners += 1;
          if (e.code === 'FOUL') t.fouls += 1;
          if (e.code === 'OFFSIDE') t.offsides += 1;
          if (e.code === 'YELLOW_CARD') t.yellowCards += 1;
          if (e.code === 'RED_CARD') t.redCards += 1;
          if (e.code === 'SAVE') t.saves += 1;
          if (e.code === 'PASS_COMPLETE') t.passesCompleted += 1;
          if (e.code === 'PASS_FAILED') t.passesFailed += 1;
          if (e.code === 'TACKLE') t.tackles += 1;
          if (e.code === 'INTERCEPTION') t.interceptions += 1;
        }
      }
    }
  }

  // Goals count as shots on target at team level.
  teams.HOME.shotsOnTarget += teams.HOME.goals;
  teams.AWAY.shotsOnTarget += teams.AWAY.goals;

  const nowMinute = input.finished ? matchLength : Math.min(Math.max(input.currentMinute, 0), matchLength);
  for (const [pid, s] of players) {
    if (!onAt.has(pid)) continue;
    const start = onAt.get(pid)!;
    const end = Math.min(offAt.get(pid) ?? nowMinute, matchLength);
    // Anyone who took the field has appeared: at least one minute.
    s.minutes = Math.max(1, end - start);
    s.cleanSheet = s.goalsConceded === 0 ? 1 : 0;
  }

  return { players, score, teams };
}
