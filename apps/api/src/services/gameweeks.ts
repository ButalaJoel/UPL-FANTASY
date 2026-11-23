import { FINISHED_STATUSES, cupRoundName, cupWinner, nextFreeTransfers, priceChange, roundRobin, type MatchStatus } from '@kiwanja/core';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import { conflict, notFound } from '../lib/http.js';
import { emit } from '../lib/realtime.js';
import { getGameRules } from '../lib/settings.js';
import { recomputeGameweek } from './scoringPipeline.js';

/**
 * Gameweek lifecycle: UPCOMING -> LIVE (deadline passed, line-ups frozen) -> FINISHED (all matches over)
 * -> LOCKED (all matches published, results final, cups advance).
 */

/** The gameweek that transfers and line-up changes currently apply to. */
export async function nextGameweek(seasonId: string) {
  return prisma.gameweek.findFirst({ where: { seasonId, status: 'UPCOMING' }, orderBy: { number: 'asc' } });
}

export async function currentGameweek(seasonId: string) {
  return (
    (await prisma.gameweek.findFirst({ where: { seasonId, isCurrent: true } })) ??
    (await prisma.gameweek.findFirst({ where: { seasonId, status: { in: ['LIVE', 'FINISHED', 'LOCKED'] } }, orderBy: { number: 'desc' } })) ??
    (await prisma.gameweek.findFirst({ where: { seasonId }, orderBy: { number: 'asc' } }))
  );
}

/** Called when a match in the gameweek kicks off or ends: starts / finishes the gameweek automatically. */
export async function onGameweekActivity(gameweekId: string | null) {
  if (!gameweekId) return;
  const gw = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gw) return;
  if (gw.status === 'UPCOMING') await startGameweek(gw.id, null);
  await maybeFinishGameweek(gw.id);
}

/** Deadline: freeze every team's line-up, roll free transfers, apply price changes, schedule H2H. */
export async function startGameweek(gameweekId: string, userId: string | null) {
  const gw = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gw) throw notFound('Gameweek');
  if (gw.status !== 'UPCOMING') throw conflict('This gameweek has already started');
  const earlier = await prisma.gameweek.findFirst({ where: { seasonId: gw.seasonId, number: { lt: gw.number }, status: 'UPCOMING' } });
  if (earlier) throw conflict(`Start gameweek ${earlier.number} first`);
  const rules = await getGameRules();

  await applyPriceChanges(gw.id, gw.seasonId);

  const teams = await prisma.fantasyTeam.findMany({ where: { seasonId: gw.seasonId }, include: { squad: { include: { player: { select: { position: true } } } } } });
  await prisma.$transaction(async (tx) => {
    await tx.gameweek.updateMany({ where: { seasonId: gw.seasonId, isCurrent: true }, data: { isCurrent: false } });
    await tx.gameweek.update({ where: { id: gw.id }, data: { status: 'LIVE', isCurrent: true } });
    for (const t of teams) {
      if (t.squad.length !== rules.squad.size) continue;
      await tx.fantasyGameweekPick.createMany({
        data: t.squad.map((s) => ({ teamId: t.id, gameweekId: gw.id, playerId: s.playerId, position: s.player.position, slot: s.slot, isCaptain: s.isCaptain, isViceCaptain: s.isViceCaptain })),
        skipDuplicates: true,
      });
      await tx.fantasyTeam.update({
        where: { id: t.id },
        data: { freeTransfers: nextFreeTransfers(t.freeTransfers, 0, rules.transfers.freePerGameweek, rules.transfers.maxBanked) },
      });
      await tx.fantasyGameweekScore.upsert({ where: { teamId_gameweekId: { teamId: t.id, gameweekId: gw.id } }, create: { teamId: t.id, gameweekId: gw.id }, update: {} });
    }
    await audit(userId, 'gameweek.start', 'gameweek', gw.id, { number: gw.number, teams: teams.length }, tx);
  });
  await scheduleH2H(gw.seasonId);
  const users = teams.map((t) => t.userId);
  await prisma.notification.createMany({ data: users.map((userId) => ({ userId, type: 'GAMEWEEK', title: `${gw.name} is live`, body: 'Your line-up is locked in. Follow your points in the match centre.', link: '/my-team' })) });
  await recomputeGameweek(gw.id);
  emit('live', 'gameweek:update', { gameweekId: gw.id, status: 'LIVE' });
}

export async function maybeFinishGameweek(gameweekId: string) {
  const gw = await prisma.gameweek.findUnique({ where: { id: gameweekId }, include: { fixtures: { select: { status: true } } } });
  if (!gw || gw.status !== 'LIVE' || !gw.fixtures.length) return;
  if (gw.fixtures.every((f) => FINISHED_STATUSES.includes(f.status as MatchStatus) || f.status === 'POSTPONED')) {
    await prisma.gameweek.update({ where: { id: gw.id }, data: { status: 'FINISHED' } });
    emit('live', 'gameweek:update', { gameweekId: gw.id, status: 'FINISHED' });
  }
}

/** Lock a gameweek: every match must be published. Confirmed points become final; cups advance. */
export async function lockGameweek(gameweekId: string, userId: string) {
  const gw = await prisma.gameweek.findUnique({ where: { id: gameweekId }, include: { fixtures: { select: { status: true } } } });
  if (!gw) throw notFound('Gameweek');
  if (gw.status === 'LOCKED') throw conflict('Already locked');
  if (gw.status === 'UPCOMING') throw conflict('This gameweek has not started');
  const unpublished = gw.fixtures.filter((f) => f.status !== 'PUBLISHED' && f.status !== 'POSTPONED').length;
  if (unpublished) throw conflict(`${unpublished} match(es) are not yet published`, 'UNPUBLISHED');
  await recomputeGameweek(gw.id);
  await prisma.gameweek.update({ where: { id: gw.id }, data: { status: 'LOCKED', lockedAt: new Date() } });
  await resolveCups(gw.seasonId, gw.number);
  await audit(userId, 'gameweek.lock', 'gameweek', gw.id, { number: gw.number });
  emit('live', 'gameweek:update', { gameweekId: gw.id, status: 'LOCKED' });
}

export async function unlockGameweek(gameweekId: string, userId: string) {
  const gw = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gw) throw notFound('Gameweek');
  if (gw.status !== 'LOCKED') throw conflict('Gameweek is not locked');
  await prisma.gameweek.update({ where: { id: gw.id }, data: { status: 'FINISHED', lockedAt: null } });
  await audit(userId, 'gameweek.unlock', 'gameweek', gw.id, { number: gw.number });
}

/** Price changes from net transfers since the previous deadline. */
async function applyPriceChanges(gameweekId: string, seasonId: string) {
  const rules = await getGameRules();
  if (!rules.pricing.enabled) return;
  const prev = await prisma.gameweek.findFirst({ where: { seasonId, status: { not: 'UPCOMING' } }, orderBy: { number: 'desc' } });
  if (!prev) return; // no price changes before the season starts
  const [ins, outs, totalTeams] = await Promise.all([
    prisma.fantasyTransfer.groupBy({ by: ['playerInId'], where: { gameweekId }, _count: true }),
    prisma.fantasyTransfer.groupBy({ by: ['playerOutId'], where: { gameweekId }, _count: true }),
    prisma.fantasyTeam.count({ where: { seasonId } }),
  ]);
  const net = new Map<string, number>();
  for (const i of ins) net.set(i.playerInId, (net.get(i.playerInId) ?? 0) + i._count);
  for (const o of outs) net.set(o.playerOutId, (net.get(o.playerOutId) ?? 0) - o._count);
  for (const [playerId, n] of net) {
    const delta = priceChange(n, totalTeams, rules.pricing);
    if (!delta) continue;
    const p = await prisma.player.findUniqueOrThrow({ where: { id: playerId } });
    const newPrice = Math.max(35, p.price + delta);
    await prisma.$transaction([
      prisma.player.update({ where: { id: playerId }, data: { price: newPrice } }),
      prisma.playerPriceChange.create({ data: { playerId, gameweekId, oldPrice: p.price, newPrice, reason: `Net transfers ${n > 0 ? '+' : ''}${n}` } }),
    ]);
  }
}

/** Create head-to-head schedules for H2H leagues whose first gameweek has arrived. */
export async function scheduleH2H(seasonId: string) {
  const live = await prisma.gameweek.findFirst({ where: { seasonId, isCurrent: true } });
  if (!live) return;
  const leagues = await prisma.fantasyLeague.findMany({
    where: { seasonId, type: 'H2H', startGameweek: { lte: live.number }, h2hMatches: { none: {} } },
    include: { members: { orderBy: { joinedAt: 'asc' } } },
  });
  const gws = await prisma.gameweek.findMany({ where: { seasonId }, orderBy: { number: 'asc' } });
  for (const l of leagues) {
    if (l.members.length < 2) continue;
    const remaining = gws.filter((g) => g.number >= Math.max(l.startGameweek, live.number));
    const rounds = roundRobin(l.members.map((m) => m.teamId), remaining.length);
    await prisma.headToHeadMatch.createMany({
      data: rounds.flatMap((pairs, i) => pairs.map(([a, b]) => ({ leagueId: l.id, gameweekNumber: remaining[i].number, gameweekId: remaining[i].id, teamAId: a, teamBId: b }))),
    });
  }
}

/** Decide cup ties for a locked gameweek and draw the next round. */
export async function resolveCups(seasonId: string, gameweekNumber: number) {
  const gw = await prisma.gameweek.findFirst({ where: { seasonId, number: gameweekNumber } });
  if (!gw) return;
  const ties = await prisma.cupFixture.findMany({ where: { gameweekNumber, winnerId: null, cup: { seasonId } }, include: { cup: true } });
  if (!ties.length) return;
  const teamIds = ties.flatMap((t) => [t.teamAId, t.teamBId]).filter(Boolean) as string[];
  const [scores, teams] = await Promise.all([
    prisma.fantasyGameweekScore.findMany({ where: { gameweekId: gw.id, teamId: { in: teamIds } } }),
    prisma.fantasyTeam.findMany({ where: { id: { in: teamIds } }, select: { id: true, confirmedTotal: true } }),
  ]);
  const score = new Map(scores.map((s) => [s.teamId, s.confirmedPoints - s.transferCost]));
  const total = new Map(teams.map((t) => [t.id, t.confirmedTotal]));
  for (const t of ties) {
    let winner: string | null;
    if (!t.teamAId || !t.teamBId) winner = t.teamAId ?? t.teamBId;
    else
      winner = cupWinner(
        { id: t.teamAId, score: score.get(t.teamAId) ?? 0, total: total.get(t.teamAId) ?? 0, seed: t.seedA ?? 999 },
        { id: t.teamBId, score: score.get(t.teamBId) ?? 0, total: total.get(t.teamBId) ?? 0, seed: t.seedB ?? 999 },
      );
    await prisma.cupFixture.update({ where: { id: t.id }, data: { winnerId: winner, scoreA: t.teamAId ? score.get(t.teamAId) ?? 0 : null, scoreB: t.teamBId ? score.get(t.teamBId) ?? 0 : null } });
  }
  // Next rounds
  for (const cupId of new Set(ties.map((t) => t.cupId))) {
    const round = ties.find((t) => t.cupId === cupId)!.round;
    const all = await prisma.cupFixture.findMany({ where: { cupId, round }, orderBy: { slot: 'asc' } });
    if (all.some((f) => !f.winnerId)) continue;
    if (all.length === 1) {
      await prisma.fantasyCup.update({ where: { id: cupId }, data: { status: 'FINISHED', winnerTeamId: all[0].winnerId } });
      continue;
    }
    const seedOf = (f: (typeof all)[number]) => (f.winnerId === f.teamAId ? f.seedA : f.seedB);
    const data = [];
    for (let i = 0; i < all.length; i += 2) {
      const a = all[i];
      const b = all[i + 1];
      data.push({ cupId, round: round + 1, roundName: cupRoundName(all.length), gameweekNumber: gameweekNumber + 1, slot: i / 2 + 1, teamAId: a.winnerId, teamBId: b?.winnerId ?? null, seedA: seedOf(a), seedB: b ? seedOf(b) : null });
    }
    await prisma.cupFixture.createMany({ data });
    await prisma.fantasyCup.update({ where: { id: cupId }, data: { status: 'RUNNING' } });
  }
}
