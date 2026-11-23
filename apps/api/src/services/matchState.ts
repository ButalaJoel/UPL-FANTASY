import { matchMinute, type MatchStatus } from '@kiwanja/core';
import { prisma } from '../db.js';
import { notFound } from '../lib/http.js';

const playerSelect = { id: true, firstName: true, lastName: true, position: true, shirtNumber: true, clubId: true } as const;

/** Full state of one match: used by the match centre, the analyst console and real-time pushes. */
export async function matchState(fixtureId: string, opts: { includeRemoved?: boolean } = {}) {
  const f = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    include: {
      homeClub: true,
      awayClub: true,
      gameweek: { select: { id: true, number: true, name: true, status: true } },
      source: { select: { id: true, name: true, kind: true } },
      squad: { include: { player: { select: playerSelect } }, orderBy: [{ isStarter: 'desc' }, { shirtNumber: 'asc' }] },
      events: {
        where: opts.includeRemoved ? {} : { status: { in: ['PENDING', 'VERIFIED', 'DISPUTED'] } },
        orderBy: [{ minute: 'asc' }, { sequence: 'asc' }],
        include: {
          player: { select: playerSelect },
          secondaryPlayer: { select: playerSelect },
          recordedBy: { select: { id: true, displayName: true } },
          verifications: { include: { user: { select: { id: true, displayName: true } } }, orderBy: { createdAt: 'asc' } },
          _count: { select: { corrections: true } },
        },
      },
      teamStats: true,
      points: { include: { player: { select: playerSelect } } },
      assignments: { include: { user: { select: { id: true, displayName: true, role: true } } } },
    },
  });
  if (!f) throw notFound('Fixture');
  const minute = matchMinute({ status: f.status as MatchStatus, periodStartedAt: f.periodStartedAt, clockAdjustSec: f.clockAdjustSec });
  const { teamStats, points, ...fixture } = f;
  return {
    fixture: { ...fixture, events: undefined, squad: undefined, assignments: undefined },
    minute,
    serverTime: new Date().toISOString(),
    squad: f.squad,
    events: f.events,
    assignments: f.assignments,
    teamStats: {
      provisional: Object.fromEntries(teamStats.filter((t) => t.basis === 'PROVISIONAL').map((t) => [t.side, t.stats])),
      confirmed: Object.fromEntries(teamStats.filter((t) => t.basis === 'CONFIRMED').map((t) => [t.side, t.stats])),
    },
    points: points
      .map((p) => ({
        playerId: p.playerId,
        player: p.player,
        minutes: p.minutes,
        provisionalPoints: p.provisionalPoints,
        confirmedPoints: p.confirmedPoints,
        provisionalBreakdown: p.provisionalBreakdown,
        confirmedBreakdown: p.confirmedBreakdown,
      }))
      .sort((a, b) => b.provisionalPoints - a.provisionalPoints),
  };
}
export type MatchState = Awaited<ReturnType<typeof matchState>>;
