import { formatPrice as corePrice, DEFAULT_GAME_RULES, type GameRules } from '@kiwanja/core';

let currency: GameRules['currency'] = DEFAULT_GAME_RULES.currency;
export const setCurrency = (c: GameRules['currency']) => (currency = c);
export const price = (tenths: number) => corePrice(tenths, { currency });

export const playerName = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : '');
export const shortName = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName[0]}. ${p.lastName}` : '');

export const dateTime = (d: string | Date) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const date = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
export const time = (d: string | Date) => new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
export const ago = (d: string | Date) => {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

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
