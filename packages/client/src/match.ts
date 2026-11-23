import { formatMinute, matchMinute } from '@kiwanja/core';
import { useEffect, useMemo, useState } from 'react';
import { shortName } from './format';
import type { MatchEventRow, MatchStateResponse } from './types';

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

/** Detailed events kept off the public timeline (still counted in stats). */
const DETAIL_EVENTS = new Set(['PASS_COMPLETE', 'PASS_FAILED', 'TACKLE', 'INTERCEPTION', 'CLEARANCE', 'FOUL', 'OFFSIDE', 'CORNER', 'KEY_PASS', 'BIG_CHANCE_CREATED', 'SHOT_OFF_TARGET', 'SHOT_BLOCKED']);
export const keyEvents = (events: MatchEventRow[]) => events.filter((e) => !DETAIL_EVENTS.has(e.code));
export const unverifiedCount = (events: MatchEventRow[]) => events.filter((e) => e.status === 'PENDING' || e.status === 'DISPUTED').length;

/** Plain-text description of an event, split so each app can style the parts. */
export function describeEvent(e: MatchEventRow): { main: string; detail?: string; kind: 'player' | 'sub' | 'period' } {
  if (!e.side) return { main: e.code.replace(/_/g, ' ').toLowerCase(), kind: 'period' };
  switch (e.code) {
    case 'GOAL':
      return { main: shortName(e.player), detail: e.secondaryPlayer ? `assist ${shortName(e.secondaryPlayer)}` : undefined, kind: 'player' };
    case 'OWN_GOAL':
      return { main: shortName(e.player), detail: 'own goal', kind: 'player' };
    case 'SUBSTITUTION':
      return { main: `▲ ${shortName(e.secondaryPlayer)}`, detail: `▼ ${shortName(e.player)}`, kind: 'sub' };
    default: {
      const what = e.code.replace(/_/g, ' ').toLowerCase();
      return { main: e.player ? shortName(e.player) : what, detail: e.player ? `${what}${e.secondaryPlayer ? ` (${shortName(e.secondaryPlayer)})` : ''}` : undefined, kind: 'player' };
    }
  }
}

export const TEAM_STAT_KEYS = ['goals', 'shotsOnTarget', 'shotsOffTarget', 'corners', 'saves', 'fouls', 'offsides', 'yellowCards', 'redCards', 'passesCompleted', 'tackles', 'interceptions'] as const;
export const statLabel = (k: string) => k.replace(/([A-Z])/g, ' $1').toLowerCase();

/** Match minute for a server snapshot. `offsetMs` = server time minus device time when the snapshot arrived. */
export function clockAt(state: MatchStateResponse, now: number, offsetMs: number) {
  const f = state.fixture;
  const minute = matchMinute({ status: f.status, periodStartedAt: f.periodStartedAt, clockAdjustSec: f.clockAdjustSec, now: new Date(now + offsetMs) });
  return { minute, label: formatMinute(minute, f.status) };
}

/**
 * Live-ticking clock. The device/server offset is measured once per snapshot, so the
 * minute keeps advancing between refreshes even if the phone's clock is wrong.
 */
export function useMatchClock(state: MatchStateResponse | undefined) {
  const [now, setNow] = useState(Date.now());
  const offset = useMemo(() => (state ? new Date(state.serverTime).getTime() - Date.now() : 0), [state?.serverTime]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!state) return { minute: 0, label: '' };
  return clockAt(state, now, offset);
}
