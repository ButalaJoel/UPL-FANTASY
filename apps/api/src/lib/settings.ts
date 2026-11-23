import { DEFAULT_GAME_RULES, gameRulesSchema, type GameRules, type ScoringRule, type StatKey } from '@kiwanja/core';
import type { ScoringRule as DbRule } from '@prisma/client';
import { prisma } from '../db.js';

export async function getGameRules(): Promise<GameRules> {
  const row = await prisma.appSetting.findUnique({ where: { key: 'gameRules' } });
  if (!row) return DEFAULT_GAME_RULES;
  const parsed = gameRulesSchema.safeParse({ ...DEFAULT_GAME_RULES, ...(row.value as object) });
  return parsed.success ? parsed.data : DEFAULT_GAME_RULES;
}

export const toCoreRule = (r: DbRule): ScoringRule => ({
  code: r.code,
  label: r.label,
  statKey: r.statKey as StatKey,
  mode: r.mode as ScoringRule['mode'],
  unit: r.unit,
  min: r.min,
  max: r.max,
  minMinutes: r.minMinutes,
  points: { GK: r.pointsGK, DEF: r.pointsDEF, MID: r.pointsMID, FWD: r.pointsFWD },
  enabled: r.enabled,
  experimental: r.experimental,
  sortOrder: r.sortOrder,
  description: r.description ?? undefined,
});

export async function getScoringRules(): Promise<ScoringRule[]> {
  return (await prisma.scoringRule.findMany({ orderBy: { sortOrder: 'asc' } })).map(toCoreRule);
}

export async function currentSeason() {
  const s = await prisma.season.findFirst({ where: { isCurrent: true }, include: { competition: true } });
  if (!s) throw new Error('No current season configured. Run the seed (pnpm db:seed).');
  return s;
}
