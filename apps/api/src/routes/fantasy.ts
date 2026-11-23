import { Router } from 'express';
import { lineupSubmitSchema, squadSubmitSchema, transferSubmitSchema } from '@kiwanja/core';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { ah, notFound, parse } from '../lib/http.js';
import { currentSeason, getGameRules } from '../lib/settings.js';
import { createTeam, myTeam, saveLineup, transfers } from '../services/fantasy.js';
import { currentGameweek, nextGameweek } from '../services/gameweeks.js';
import { teamRank } from '../services/leagues.js';

export const fantasyRouter = Router();

const playerInclude = { club: { select: { id: true, name: true, shortName: true, primaryColor: true, secondaryColor: true } } } as const;

/** One team's picks and points for a gameweek (anyone can view, like on FPL). */
async function teamGameweek(teamId: string, gameweekId: string) {
  const [picks, score, points] = await Promise.all([
    prisma.fantasyGameweekPick.findMany({ where: { teamId, gameweekId }, include: { player: { include: playerInclude } }, orderBy: { slot: 'asc' } }),
    prisma.fantasyGameweekScore.findUnique({ where: { teamId_gameweekId: { teamId, gameweekId } } }),
    prisma.playerFixturePoints.findMany({ where: { gameweekId, player: { gameweekPicks: { some: { teamId, gameweekId } } } }, include: { fixture: { select: { id: true, status: true, homeClubId: true, awayClubId: true } } } }),
  ]);
  const breakdown = (score?.breakdown ?? null) as { provisional?: { lines: { playerId: string; multiplier: number; points: number; counted: boolean; subbedIn: boolean; subbedOut: boolean }[]; autoSubs: unknown[]; multiplierTo: string | null } } | null;
  const lineFor = (id: string) => breakdown?.provisional?.lines.find((l) => l.playerId === id);
  return {
    gameweekId,
    score: score ? { provisional: score.provisionalPoints, confirmed: score.confirmedPoints, transferCost: score.transferCost, transfersMade: score.transfersMade, net: score.provisionalPoints - score.transferCost } : null,
    autoSubs: breakdown?.provisional?.autoSubs ?? [],
    multiplierTo: breakdown?.provisional?.multiplierTo ?? null,
    picks: picks.map((p) => {
      const pts = points.filter((x) => x.playerId === p.playerId);
      const line = lineFor(p.playerId);
      return {
        ...p,
        provisionalPoints: pts.reduce((s, x) => s + x.provisionalPoints, 0),
        confirmedPoints: pts.reduce((s, x) => s + x.confirmedPoints, 0),
        minutes: pts.reduce((s, x) => s + x.minutes, 0),
        breakdown: pts.map((x) => ({ fixtureId: x.fixtureId, provisional: x.provisionalBreakdown, confirmed: x.confirmedBreakdown, fixtureStatus: x.fixture.status })),
        multiplier: line?.multiplier ?? (p.slot <= 11 ? 1 : 0),
        counted: line?.counted ?? p.slot <= 11,
        subbedIn: line?.subbedIn ?? false,
        subbedOut: line?.subbedOut ?? false,
        teamPoints: line?.points ?? 0,
      };
    }),
  };
}

fantasyRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const team = await myTeam(req.user!.id);
    if (!team) return res.json({ team: null });
    const season = await currentSeason();
    const rules = await getGameRules();
    const [squad, current, next, rank, picksCount] = await Promise.all([
      prisma.fantasySquadPlayer.findMany({ where: { teamId: team.id }, include: { player: { include: playerInclude } }, orderBy: { slot: 'asc' } }),
      currentGameweek(season.id),
      nextGameweek(season.id),
      teamRank(team.id),
      prisma.fantasyGameweekPick.count({ where: { teamId: team.id } }),
    ]);
    // Next opponent for each club in the next gameweek.
    const nextFixtures = next ? await prisma.fixture.findMany({ where: { gameweekId: next.id }, include: { homeClub: { select: { shortName: true } }, awayClub: { select: { shortName: true } } } }) : [];
    const opp = new Map<string, string>();
    for (const f of nextFixtures) {
      opp.set(f.homeClubId, `${f.awayClub.shortName} (H)`);
      opp.set(f.awayClubId, `${f.homeClub.shortName} (A)`);
    }
    const live = current && current.status !== 'UPCOMING' ? await teamGameweek(team.id, current.id) : null;
    res.json({
      team,
      rank,
      squad: squad.map((s) => ({ ...s, nextOpponent: opp.get(s.player.clubId) ?? null })),
      squadValue: squad.reduce((s, x) => s + x.player.price, 0),
      currentGameweek: current,
      nextGameweek: next,
      live: live && live.picks.length ? live : null,
      transfersInfo: {
        freeTransfers: team.freeTransfers,
        unlimited: picksCount === 0 && rules.transfers.unlimitedBeforeFirstDeadline,
        hitCost: rules.transfers.hitCost,
        wildcardsLeft: rules.transfers.wildcardsPerSeason - team.wildcardsUsed,
        wildcardActive: !!next && team.wildcardGameweek === next.number,
      },
    });
  }),
);

fantasyRouter.post(
  '/team',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(squadSubmitSchema, req.body);
    res.status(201).json(await createTeam(req.user!.id, body.name, body.playerIds));
  }),
);

fantasyRouter.patch(
  '/team',
  requireAuth,
  ah(async (req, res) => {
    const { name } = parse(z.object({ name: z.string().min(3).max(30) }), req.body);
    const team = await myTeam(req.user!.id);
    if (!team) throw notFound('Team');
    res.json(await prisma.fantasyTeam.update({ where: { id: team.id }, data: { name } }));
  }),
);

fantasyRouter.put(
  '/lineup',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(lineupSubmitSchema, req.body);
    res.json(await saveLineup(req.user!.id, body.picks));
  }),
);

fantasyRouter.post(
  '/transfers/preview',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(transferSubmitSchema, req.body);
    res.json(await transfers(req.user!.id, body.transfers, body.useWildcard, false));
  }),
);

fantasyRouter.post(
  '/transfers',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(transferSubmitSchema, req.body);
    res.json(await transfers(req.user!.id, body.transfers, body.useWildcard, true));
  }),
);

fantasyRouter.get(
  '/transfers',
  requireAuth,
  ah(async (req, res) => {
    const team = await myTeam(req.user!.id);
    if (!team) return res.json([]);
    res.json(
      await prisma.fantasyTransfer.findMany({
        where: { teamId: team.id },
        include: { playerIn: { include: playerInclude }, playerOut: { include: playerInclude }, gameweek: { select: { number: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
);

fantasyRouter.get(
  '/history',
  requireAuth,
  ah(async (req, res) => {
    const team = await myTeam(req.user!.id);
    if (!team) return res.json({ gameweeks: [] });
    const scores = await prisma.fantasyGameweekScore.findMany({ where: { teamId: team.id }, include: { gameweek: true }, orderBy: { gameweek: { number: 'asc' } } });
    const avgs = await prisma.fantasyGameweekScore.groupBy({ by: ['gameweekId'], _avg: { provisionalPoints: true } });
    const avg = new Map(avgs.map((a) => [a.gameweekId, Math.round(a._avg.provisionalPoints ?? 0)]));
    let running = 0;
    res.json({
      team,
      gameweeks: scores.map((s) => {
        running += s.provisionalPoints - s.transferCost;
        return { gameweek: s.gameweek.number, gameweekId: s.gameweekId, status: s.gameweek.status, points: s.provisionalPoints, confirmed: s.confirmedPoints, transferCost: s.transferCost, transfers: s.transfersMade, average: avg.get(s.gameweekId) ?? 0, total: running };
      }),
    });
  }),
);

fantasyRouter.get(
  '/teams/:teamId',
  ah(async (req, res) => {
    const team = await prisma.fantasyTeam.findUnique({ where: { id: req.params.teamId }, include: { user: { select: { displayName: true, avatarColor: true, avatarUrl: true } } } });
    if (!team) throw notFound('Team');
    const season = await currentSeason();
    const gwNumber = req.query.gameweek ? Number(req.query.gameweek) : (await currentGameweek(season.id))?.number;
    const gw = gwNumber ? await prisma.gameweek.findFirst({ where: { seasonId: season.id, number: gwNumber } }) : null;
    res.json({ team, rank: await teamRank(team.id), gameweek: gw, view: gw ? await teamGameweek(team.id, gw.id) : null });
  }),
);
