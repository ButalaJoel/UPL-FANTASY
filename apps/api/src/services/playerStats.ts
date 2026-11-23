import { prisma } from '../db.js';

export interface PlayerAggregate {
  totalPoints: number;
  confirmedPoints: number;
  goals: number;
  assists: number;
  appearances: number;
  minutes: number;
  yellowCards: number;
  redCards: number;
  cleanSheets: number;
  saves: number;
  shotsOnTarget: number;
  form: number;
  selectedByPct: number;
}

const empty = (): PlayerAggregate => ({ totalPoints: 0, confirmedPoints: 0, goals: 0, assists: 0, appearances: 0, minutes: 0, yellowCards: 0, redCards: 0, cleanSheets: 0, saves: 0, shotsOnTarget: 0, form: 0, selectedByPct: 0 });

/** Season aggregates for players, computed from derived match statistics and points (provisional = live). */
export async function playerAggregates(playerIds?: string[]): Promise<Map<string, PlayerAggregate>> {
  const where = playerIds ? { playerId: { in: playerIds } } : {};
  const [stats, pts, selections, teamCount] = await Promise.all([
    prisma.playerMatchStat.findMany({
      where: { ...where, basis: 'PROVISIONAL' },
      select: { playerId: true, minutes: true, goals: true, assists: true, yellowCards: true, redCards: true, cleanSheet: true, saves: true, shotsOnTarget: true },
    }),
    prisma.playerFixturePoints.findMany({ where, select: { playerId: true, provisionalPoints: true, confirmedPoints: true, minutes: true, fixture: { select: { kickoffAt: true } } } }),
    prisma.fantasySquadPlayer.groupBy({ by: ['playerId'], where, _count: true }),
    prisma.fantasyTeam.count(),
  ]);
  const out = new Map<string, PlayerAggregate>();
  const get = (id: string) => {
    let a = out.get(id);
    if (!a) out.set(id, (a = empty()));
    return a;
  };
  for (const s of stats) {
    const a = get(s.playerId);
    a.minutes += s.minutes;
    a.goals += s.goals;
    a.assists += s.assists;
    a.yellowCards += s.yellowCards;
    a.redCards += s.redCards;
    a.saves += s.saves;
    a.shotsOnTarget += s.shotsOnTarget;
    if (s.minutes > 0) a.appearances += 1;
    if (s.cleanSheet && s.minutes >= 60) a.cleanSheets += 1;
  }
  const recent = new Map<string, { t: number; p: number }[]>();
  for (const p of pts) {
    const a = get(p.playerId);
    a.totalPoints += p.provisionalPoints;
    a.confirmedPoints += p.confirmedPoints;
    recent.set(p.playerId, [...(recent.get(p.playerId) ?? []), { t: p.fixture.kickoffAt.getTime(), p: p.provisionalPoints }]);
  }
  for (const [id, list] of recent) {
    const last = list.sort((x, y) => y.t - x.t).slice(0, 3);
    get(id).form = Math.round((last.reduce((s, x) => s + x.p, 0) / Math.max(1, last.length)) * 10) / 10;
  }
  for (const s of selections) get(s.playerId).selectedByPct = teamCount ? Math.round((s._count / teamCount) * 1000) / 10 : 0;
  return out;
}

export const aggregateOrEmpty = (m: Map<string, PlayerAggregate>, id: string) => m.get(id) ?? empty();
