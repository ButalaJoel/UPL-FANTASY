import { z } from 'zod';
import type { Position } from './football.js';

/**
 * Game rules administrators can change without touching code (stored in app_settings).
 * Money is stored in integer tenths of a unit: 1000 = 100.0m.
 */
export const gameRulesSchema = z.object({
  currency: z.object({ symbol: z.string().min(1).max(4), suffix: z.string().max(3), name: z.string() }),
  squad: z.object({
    size: z.number().int().min(5).max(25),
    composition: z.object({ GK: z.number().int().min(1), DEF: z.number().int().min(1), MID: z.number().int().min(1), FWD: z.number().int().min(1) }),
    budget: z.number().int().positive(),
    maxPerClub: z.number().int().min(1),
    startersCount: z.number().int().min(5).max(11),
  }),
  formations: z.array(z.string().regex(/^\d-\d-\d$/)).min(1),
  minFormation: z.object({ GK: z.number().int(), DEF: z.number().int(), MID: z.number().int(), FWD: z.number().int() }),
  captain: z.object({ multiplier: z.number().int().min(1).max(4), viceTakesOver: z.boolean() }),
  autoSubs: z.boolean(),
  transfers: z.object({
    freePerGameweek: z.number().int().min(0),
    maxBanked: z.number().int().min(1),
    hitCost: z.number().int().min(0),
    wildcardsPerSeason: z.number().int().min(0),
    unlimitedBeforeFirstDeadline: z.boolean(),
  }),
  pricing: z.object({
    enabled: z.boolean(),
    /** Net transfers in, as a share of all teams, that triggers a 0.1 change. */
    thresholdPct: z.number().positive(),
    step: z.number().int().positive(),
    maxChangePerGameweek: z.number().int().positive(),
  }),
  verification: z.object({
    /** Provisional points appear the moment an event is logged; confirmed after verification. */
    provisionalPoints: z.boolean(),
  }),
  matchLength: z.number().int().min(20).max(120),
});
export type GameRules = z.infer<typeof gameRulesSchema>;

export const DEFAULT_GAME_RULES: GameRules = {
  currency: { symbol: 'K', suffix: 'm', name: 'Kiwanja credits' },
  squad: { size: 15, composition: { GK: 2, DEF: 5, MID: 5, FWD: 3 }, budget: 1000, maxPerClub: 3, startersCount: 11 },
  formations: ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-3-2', '5-4-1'],
  minFormation: { GK: 1, DEF: 3, MID: 2, FWD: 1 },
  captain: { multiplier: 2, viceTakesOver: true },
  autoSubs: true,
  transfers: { freePerGameweek: 1, maxBanked: 5, hitCost: 4, wildcardsPerSeason: 2, unlimitedBeforeFirstDeadline: true },
  pricing: { enabled: true, thresholdPct: 2, step: 1, maxChangePerGameweek: 3 },
  verification: { provisionalPoints: true },
  matchLength: 90,
};

export function formatPrice(tenths: number, rules: Pick<GameRules, 'currency'> = DEFAULT_GAME_RULES): string {
  return `${rules.currency.symbol}${(tenths / 10).toFixed(1)}${rules.currency.suffix}`;
}

export const parseFormation = (f: string): Record<Position, number> => {
  const [d, m, fw] = f.split('-').map(Number);
  return { GK: 1, DEF: d, MID: m, FWD: fw };
};
