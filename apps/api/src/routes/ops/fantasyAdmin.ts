import { Router } from 'express';
import { cupCreateSchema, gameRulesSchema, leagueCreateSchema, scoringRuleSchema } from '@kiwanja/core';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../db.js';
import { audit } from '../../lib/audit.js';
import { requirePermission } from '../../lib/auth.js';
import { ah, conflict, parse } from '../../lib/http.js';
import { currentSeason, getGameRules } from '../../lib/settings.js';
import { createCup, uniqueCode } from '../../services/leagues.js';
import { recomputeAll } from '../../services/scoringPipeline.js';

export const fantasyAdminRouter = Router();
fantasyAdminRouter.use(requirePermission('fantasy.manage'));

fantasyAdminRouter.get(
  '/scoring-rules',
  ah(async (_req, res) => {
    res.json(await prisma.scoringRule.findMany({ orderBy: { sortOrder: 'asc' } }));
  }),
);

/** Change a scoring rule. All points are recalculated from the event log immediately. */
fantasyAdminRouter.put(
  '/scoring-rules/:code',
  ah(async (req, res) => {
    const body = parse(scoringRuleSchema, req.body);
    const before = await prisma.scoringRule.findUniqueOrThrow({ where: { code: req.params.code } });
    const locked = await prisma.gameweek.count({ where: { status: 'LOCKED' } });
    const rule = await prisma.scoringRule.update({
      where: { code: req.params.code },
      data: { label: body.label, statKey: body.statKey, mode: body.mode, unit: body.unit, min: body.min, max: body.max, minMinutes: body.minMinutes, pointsGK: body.points.GK, pointsDEF: body.points.DEF, pointsMID: body.points.MID, pointsFWD: body.points.FWD, enabled: body.enabled, description: body.description ?? null },
    });
    await audit(req.user!.id, 'scoring.rule.update', 'scoring_rule', rule.id, { before, after: rule });
    const recomputed = await recomputeAll();
    res.json({ rule, recomputed, warning: locked ? `${locked} locked gameweek(s) were recalculated too. Locked gameweeks keep their published match data but totals reflect the new rules.` : undefined });
  }),
);

fantasyAdminRouter.post(
  '/scoring-rules',
  ah(async (req, res) => {
    const body = parse(scoringRuleSchema.extend({ code: scoringRuleSchema.shape.label.regex(/^[A-Z0-9_]+$/) }), req.body);
    const max = await prisma.scoringRule.aggregate({ _max: { sortOrder: true } });
    const rule = await prisma.scoringRule.create({
      data: { code: body.code, label: body.label, statKey: body.statKey, mode: body.mode, unit: body.unit, min: body.min, max: body.max, minMinutes: body.minMinutes, pointsGK: body.points.GK, pointsDEF: body.points.DEF, pointsMID: body.points.MID, pointsFWD: body.points.FWD, enabled: body.enabled, experimental: true, sortOrder: (max._max.sortOrder ?? 0) + 10, description: body.description ?? null },
    });
    await audit(req.user!.id, 'scoring.rule.create', 'scoring_rule', rule.id, rule);
    await recomputeAll();
    res.status(201).json(rule);
  }),
);

fantasyAdminRouter.post(
  '/recompute',
  ah(async (req, res) => {
    const r = await recomputeAll();
    await audit(req.user!.id, 'scoring.recompute', 'system', null, r);
    res.json(r);
  }),
);

fantasyAdminRouter.get(
  '/game-rules',
  ah(async (_req, res) => {
    res.json(await getGameRules());
  }),
);

fantasyAdminRouter.put(
  '/game-rules',
  ah(async (req, res) => {
    const rules = parse(gameRulesSchema, req.body);
    const sum = rules.squad.composition.GK + rules.squad.composition.DEF + rules.squad.composition.MID + rules.squad.composition.FWD;
    if (sum !== rules.squad.size) throw conflict(`Position quotas add up to ${sum}, but the squad size is ${rules.squad.size}`);
    const before = await getGameRules();
    await prisma.appSetting.upsert({ where: { key: 'gameRules' }, create: { key: 'gameRules', value: rules as unknown as Prisma.InputJsonValue, updatedById: req.user!.id }, update: { value: rules as unknown as Prisma.InputJsonValue, updatedById: req.user!.id } });
    await audit(req.user!.id, 'settings.gameRules', 'app_settings', 'gameRules', { before, after: rules });
    res.json(rules);
  }),
);

fantasyAdminRouter.get(
  '/leagues',
  ah(async (_req, res) => {
    const season = await currentSeason();
    res.json(await prisma.fantasyLeague.findMany({ where: { seasonId: season.id }, include: { owner: { select: { displayName: true } }, _count: { select: { members: true, h2hMatches: true } } }, orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }] }));
  }),
);

fantasyAdminRouter.post(
  '/leagues',
  ah(async (req, res) => {
    const body = parse(leagueCreateSchema, req.body);
    const season = await currentSeason();
    const league = await prisma.fantasyLeague.create({ data: { seasonId: season.id, name: body.name, type: body.type, visibility: body.visibility, code: await uniqueCode(), ownerId: req.user!.id, startGameweek: body.startGameweek ?? 1 } });
    await audit(req.user!.id, 'league.create', 'fantasy_league', league.id, body);
    res.status(201).json(league);
  }),
);

fantasyAdminRouter.delete(
  '/leagues/:id',
  ah(async (req, res) => {
    const l = await prisma.fantasyLeague.findUniqueOrThrow({ where: { id: req.params.id } });
    if (l.isSystem) throw conflict('The overall league cannot be deleted');
    await prisma.fantasyLeague.delete({ where: { id: l.id } });
    await audit(req.user!.id, 'league.delete', 'fantasy_league', l.id, { name: l.name });
    res.json({ ok: true });
  }),
);

fantasyAdminRouter.post(
  '/cups',
  ah(async (req, res) => {
    const body = parse(cupCreateSchema, req.body);
    const cup = await createCup(body);
    await audit(req.user!.id, 'cup.create', 'fantasy_cup', cup.id, body);
    res.status(201).json(cup);
  }),
);

fantasyAdminRouter.delete(
  '/cups/:id',
  ah(async (req, res) => {
    await prisma.fantasyCup.delete({ where: { id: req.params.id } });
    await audit(req.user!.id, 'cup.delete', 'fantasy_cup', req.params.id);
    res.json({ ok: true });
  }),
);
