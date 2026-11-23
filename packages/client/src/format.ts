import { DEFAULT_GAME_RULES, formatPrice as corePrice, type GameRules } from '@kiwanja/core';

let currency: GameRules['currency'] = DEFAULT_GAME_RULES.currency;
/** The currency comes from the server's game rules (see useMeta). */
export const setCurrency = (c: GameRules['currency']) => (currency = c);
export const price = (tenths: number) => corePrice(tenths, { currency });

type Named = { firstName: string; lastName: string } | null | undefined;
export const playerName = (p: Named) => (p ? `${p.firstName} ${p.lastName}` : '');
export const shortName = (p: Named) => (p ? `${p.firstName[0]}. ${p.lastName}` : '');

export const dateTime = (d: string | Date) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const date = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const dayLabel = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
export const time = (d: string | Date) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
export const ago = (d: string | Date, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

/** "5d 03:12:09" style countdown text; null once the time has passed. */
export function countdown(to: string | Date, now = Date.now()): string | null {
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${d ? `${d}d ` : ''}${hh}:${mm}:${ss}`;
}

export const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  FIRST_HALF: '1st half',
  HALF_TIME: 'Half-time',
  SECOND_HALF: '2nd half',
  FULL_TIME: 'Full-time',
  COMPLETED: 'Completed',
  PUBLISHED: 'Final',
  POSTPONED: 'Postponed',
};
export const isLive = (s: string) => ['FIRST_HALF', 'HALF_TIME', 'SECOND_HALF'].includes(s);
export const isFinished = (s: string) => ['FULL_TIME', 'COMPLETED', 'PUBLISHED'].includes(s);

export const humanize = (code: string) => code.replace(/_/g, ' ').toLowerCase();
export const initials = (name: string) =>
  name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
