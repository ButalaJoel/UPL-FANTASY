import { defaultLineup, transferCost, validateLineup, validateSquad, type Position, type SquadPlayer } from '@kiwanja/core';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import { badRequest, conflict, notFound } from '../lib/http.js';
import { currentSeason, getGameRules } from '../lib/settings.js';
import { nextGameweek } from './gameweeks.js';

export async function myTeam(userId: string) {
  const season = await currentSeason();
  return prisma.fantasyTeam.findUnique({ where: { userId_seasonId: { userId, seasonId: season.id } } });
}

const toSquadPlayers = (players: { id: string; position: string; clubId: string; price: number }[]): SquadPlayer[] =>
  players.map((p) => ({ playerId: p.id, position: p.position as Position, clubId: p.clubId, price: p.price }));

/** Create a fantasy team from a full squad selection. */
export async function createTeam(userId: string, name: string, playerIds: string[]) {
  const season = await currentSeason();
  if (await myTeam(userId)) throw conflict('You already have a team this season');
  const rules = await getGameRules();
  const players = await prisma.player.findMany({ where: { id: { in: playerIds }, active: true } });
  if (players.length !== playerIds.length) throw badRequest('Some selected players are not available');
  const squad = toSquadPlayers(players);
  const issues = validateSquad(squad, rules);
  if (issues.length) throw badRequest(issues[0].message, { issues });
  const lineup = defaultLineup(squad, rules);
  const cost = players.reduce((s, p) => s + p.price, 0);
  const next = await nextGameweek(season.id);
  const priceOf = new Map(players.map((p) => [p.id, p.price]));

  const team = await prisma.$transaction(async (tx) => {
    const t = await tx.fantasyTeam.create({
      data: { userId, seasonId: season.id, name, bank: rules.squad.budget - cost, freeTransfers: 0, startGameweek: next?.number ?? 1 },
    });
    await tx.fantasySquadPlayer.createMany({ data: lineup.map((l) => ({ teamId: t.id, playerId: l.playerId, purchasePrice: priceOf.get(l.playerId)!, slot: l.slot, isCaptain: l.isCaptain, isViceCaptain: l.isViceCaptain })) });
    // Everyone joins the overall league automatically.
    const overall = await tx.fantasyLeague.findFirst({ where: { seasonId: season.id, isSystem: true } });
    if (overall) await tx.leagueMember.create({ data: { leagueId: overall.id, teamId: t.id } });
    await audit(userId, 'fantasy.team.create', 'fantasy_team', t.id, { name, cost }, tx);
    return t;
  });
  return team;
}

/** Save starting XI, bench order, captain and vice-captain for the next deadline. */
export async function saveLineup(userId: string, picks: { playerId: string; slot: number; isCaptain: boolean; isViceCaptain: boolean }[]) {
  const team = await myTeam(userId);
  if (!team) throw notFound('Team');
  const rules = await getGameRules();
  const squad = await prisma.fantasySquadPlayer.findMany({ where: { teamId: team.id }, include: { player: true } });
  const owned = new Map(squad.map((s) => [s.playerId, s]));
  if (picks.length !== squad.length || picks.some((p) => !owned.has(p.playerId))) throw badRequest('The line-up must contain exactly your squad players');
  const full = picks.map((p) => ({ ...p, position: owned.get(p.playerId)!.player.position as Position }));
  const issues = validateLineup(full, rules);
  if (issues.length) throw badRequest(issues[0].message, { issues });
  await prisma.$transaction(async (tx) => {
    // Two-phase slot update avoids unique (teamId, slot) clashes while swapping.
    for (const p of full) await tx.fantasySquadPlayer.update({ where: { teamId_playerId: { teamId: team.id, playerId: p.playerId } }, data: { slot: 100 + p.slot } });
    for (const p of full) await tx.fantasySquadPlayer.update({ where: { teamId_playerId: { teamId: team.id, playerId: p.playerId } }, data: { slot: p.slot, isCaptain: p.isCaptain, isViceCaptain: p.isViceCaptain } });
  });
  return { ok: true };
}

/** Preview or apply transfers. Costs follow the configured free-transfer and hit rules. */
export async function transfers(userId: string, list: { outId: string; inId: string }[], useWildcard: boolean, apply: boolean) {
  const team = await myTeam(userId);
  if (!team) throw notFound('Team');
  const season = await currentSeason();
  const gw = await nextGameweek(season.id);
  if (!gw) throw conflict('There is no upcoming gameweek to make transfers for');
  const rules = await getGameRules();
  const squad = await prisma.fantasySquadPlayer.findMany({ where: { teamId: team.id }, include: { player: true } });
  const outIds = list.map((t) => t.outId);
  const inIds = list.map((t) => t.inId);
  if (new Set(outIds).size !== outIds.length || new Set(inIds).size !== inIds.length) throw badRequest('Each player can only be transferred once');
  const owned = new Map(squad.map((s) => [s.playerId, s]));
  for (const id of outIds) if (!owned.has(id)) throw badRequest('You can only sell players in your squad');
  for (const id of inIds) if (owned.has(id) && !outIds.includes(id)) throw badRequest('That player is already in your squad');
  const incoming = await prisma.player.findMany({ where: { id: { in: inIds }, active: true } });
  if (incoming.length !== inIds.length) throw badRequest('Some players are not available');
  const inMap = new Map(incoming.map((p) => [p.id, p]));
  for (const t of list) if (owned.get(t.outId)!.player.position !== inMap.get(t.inId)!.position) throw badRequest('Transfers must replace a player with one in the same position');

  // Selling price = current price (prototype rule; configurable profit-sharing can come later).
  const sellValue = list.reduce((s, t) => s + owned.get(t.outId)!.player.price, 0);
  const buyValue = list.reduce((s, t) => s + inMap.get(t.inId)!.price, 0);
  const bank = team.bank + sellValue - buyValue;
  const newSquad = [
    ...squad.filter((s) => !outIds.includes(s.playerId)).map((s) => ({ id: s.playerId, position: s.player.position, clubId: s.player.clubId, price: s.player.price })),
    ...incoming.map((p) => ({ id: p.id, position: p.position, clubId: p.clubId, price: p.price })),
  ];
  const issues = validateSquad(
    newSquad.map((p) => ({ playerId: p.id, position: p.position as Position, clubId: p.clubId, price: 0 })),
    rules,
  );
  if (bank < 0) issues.push({ code: 'BUDGET', message: `Not enough money in the bank (short by ${(-bank / 10).toFixed(1)}m)` });

  const hasPlayed = (await prisma.fantasyGameweekPick.count({ where: { teamId: team.id } })) > 0;
  const wildcardsLeft = rules.transfers.wildcardsPerSeason - team.wildcardsUsed;
  const wildcardActive = team.wildcardGameweek === gw.number;
  if (useWildcard && !wildcardActive && wildcardsLeft <= 0) issues.push({ code: 'WILDCARD', message: 'No wildcards left this season' });
  const unlimited = !hasPlayed && rules.transfers.unlimitedBeforeFirstDeadline;
  const { cost, freeUsed } = transferCost({ count: list.length, freeTransfers: team.freeTransfers, hitCost: rules.transfers.hitCost, wildcard: useWildcard || wildcardActive, unlimited });
  const preview = { gameweek: gw.number, count: list.length, cost, freeUsed, freeTransfers: team.freeTransfers, bankAfter: bank, unlimited, wildcard: useWildcard || wildcardActive, issues };
  if (!apply || issues.length) {
    if (apply) throw badRequest(issues[0].message, preview);
    return preview;
  }

  await prisma.$transaction(async (tx) => {
    for (const t of list) {
      const old = owned.get(t.outId)!;
      const p = inMap.get(t.inId)!;
      await tx.fantasySquadPlayer.delete({ where: { id: old.id } });
      await tx.fantasySquadPlayer.create({ data: { teamId: team.id, playerId: p.id, purchasePrice: p.price, slot: old.slot, isCaptain: old.isCaptain, isViceCaptain: old.isViceCaptain } });
    }
    // Spread the hit across the records so each transfer explains its cost.
    let remainingCost = cost;
    for (const [i, t] of list.entries()) {
      const c = i < freeUsed ? 0 : Math.min(remainingCost, rules.transfers.hitCost);
      remainingCost -= c;
      await tx.fantasyTransfer.create({
        data: { teamId: team.id, gameweekId: gw.id, playerOutId: t.outId, playerInId: t.inId, priceOut: owned.get(t.outId)!.player.price, priceIn: inMap.get(t.inId)!.price, cost: unlimited ? 0 : c, isWildcard: useWildcard || wildcardActive },
      });
    }
    await tx.fantasyTeam.update({
      where: { id: team.id },
      data: {
        bank,
        freeTransfers: Math.max(0, team.freeTransfers - freeUsed),
        ...(useWildcard && !wildcardActive ? { wildcardsUsed: { increment: 1 }, wildcardGameweek: gw.number } : {}),
      },
    });
    await audit(userId, 'fantasy.transfer', 'fantasy_team', team.id, { list, cost, gameweek: gw.number }, tx);
  });
  return { ...preview, applied: true };
}
