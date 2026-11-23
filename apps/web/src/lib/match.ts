import { matchMinute, formatMinute, type MatchStatus } from '@kiwanja/core';
import { useEffect, useState } from 'react';

export interface MatchPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  shirtNumber: number | null;
  clubId: string;
}
export interface MatchEventRow {
  id: string;
  clientEventId: string;
  sequence: number;
  code: string;
  side: 'HOME' | 'AWAY' | null;
  minute: number;
  status: string;
  origin: string;
  version: number;
  playerId: string | null;
  secondaryPlayerId: string | null;
  player: MatchPlayer | null;
  secondaryPlayer: MatchPlayer | null;
  recordedBy?: { id: string; displayName: string };
  recordedAt: string;
  clientRecordedAt: string;
  details: Record<string, unknown> | null;
  verifications: { decision: string; createdAt: string; note?: string | null; user?: { id: string; displayName: string } | null }[];
  _count?: { corrections: number };
}
export interface SquadRow {
  id: string;
  playerId: string;
  side: 'HOME' | 'AWAY';
  isStarter: boolean;
  shirtNumber: number | null;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  player: MatchPlayer;
}
export interface MatchStateResponse {
  fixture: {
    id: string;
    status: MatchStatus;
    homeScore: number;
    awayScore: number;
    kickoffAt: string;
    venue: string | null;
    origin: string;
    periodStartedAt: string | null;
    clockAdjustSec: number;
    homeClubId: string;
    awayClubId: string;
    homeClub: { id: string; name: string; shortName: string; primaryColor: string; secondaryColor: string };
    awayClub: { id: string; name: string; shortName: string; primaryColor: string; secondaryColor: string };
    gameweek: { id: string; number: number; name: string; status: string } | null;
    source: { id: string; name: string; kind: string } | null;
  };
  minute: number;
  serverTime: string;
  squad: SquadRow[];
  events: MatchEventRow[];
  assignments?: { userId: string; role: string; user: { id: string; displayName: string; role: string } }[];
  teamStats: { provisional: Record<string, Record<string, number>>; confirmed: Record<string, Record<string, number>> };
  points: { playerId: string; player: MatchPlayer; minutes: number; provisionalPoints: number; confirmedPoints: number; provisionalBreakdown: { code: string; label: string; value: number; points: number }[]; confirmedBreakdown: { code: string; label: string; value: number; points: number }[] }[];
}

export const EVENT_ICON: Record<string, string> = {
  GOAL: '⚽',
  OWN_GOAL: '⚽',
  YELLOW_CARD: '🟨',
  RED_CARD: '🟥',
  SUBSTITUTION: '🔁',
  PENALTY_AWARDED: '🎯',
  PENALTY_MISSED: '✖️',
  PENALTY_SAVED: '🧤',
  SAVE: '🧤',
  SHOT_ON_TARGET: '🎯',
  SHOT_OFF_TARGET: '↗️',
  SHOT_BLOCKED: '🛡️',
  KEY_PASS: '🔑',
  BIG_CHANCE_CREATED: '💡',
  PASS_COMPLETE: '✅',
  PASS_FAILED: '❌',
  TACKLE: '🦵',
  INTERCEPTION: '✋',
  CLEARANCE: '🧹',
  FOUL: '⚠️',
  OFFSIDE: '🚩',
  CORNER: '⛳',
  MAN_OF_THE_MATCH: '⭐',
  MATCH_START: '▶️',
  HALF_TIME: '⏸️',
  SECOND_HALF_START: '▶️',
  FULL_TIME: '🏁',
};

/** Live-ticking clock synced to the server time of the last fetch. */
export function useMatchClock(state: MatchStateResponse | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!state) return { minute: 0, label: '' };
  const offset = new Date(state.serverTime).getTime() - Date.now();
  const f = state.fixture;
  const minute = matchMinute({ status: f.status, periodStartedAt: f.periodStartedAt, clockAdjustSec: f.clockAdjustSec, now: new Date(now + offset) });
  return { minute, label: formatMinute(minute, f.status) };
}
