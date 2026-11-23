/**
 * Section 15 of the brief: the live-goal demonstration, end to end through the real API,
 * database, scoring engine and Socket.IO. Also covers assists, cards, substitutions,
 * clean sheets, saves, shots on target, corrections, duplicate prevention, offline sync
 * and permission checks.
 */
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { closeRealtime, initRealtime } from '../src/lib/realtime.js';

const app = createApp();
let server: Server;
let socket: Socket;
const tokens: Record<string, string> = {};
const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

const ctx: {
  fixtureId: string;
  gameweekId: string;
  homeClubId: string;
  awayClubId: string;
  scorer: string; // in the fan's starting XI
  assister: string;
  homeGk: string;
  awayGk: string;
  homeDef: string;
  sub: string;
  carded: string;
  sentOff: string;
  fanTeamId: string;
} = {} as never;

const ev = (code: string, minute: number, extra: Record<string, unknown> = {}) => ({ clientEventId: randomUUID(), code, minute, clientRecordedAt: new Date().toISOString(), ...extra });
const post = (who: string, path: string, body?: unknown) => request(app).post(`/api${path}`).set(auth(who)).send(body ?? {});
const get = (who: string | null, path: string) => (who ? request(app).get(`/api${path}`).set(auth(who)) : request(app).get(`/api${path}`));
const points = async (playerId: string) => prisma.playerFixturePoints.findUnique({ where: { fixtureId_playerId: { fixtureId: ctx.fixtureId, playerId } } });
const fanTeam = () => prisma.fantasyTeam.findUniqueOrThrow({ where: { id: ctx.fanTeamId } });
const fanScore = () => prisma.fantasyGameweekScore.findUnique({ where: { teamId_gameweekId: { teamId: ctx.fanTeamId, gameweekId: ctx.gameweekId } } });

beforeAll(async () => {
  server = createServer(app);
  initRealtime(server);
  await new Promise<void>((r) => server.listen(0, r));
  for (const [who, email] of [
    ['admin', 'admin@kiwanja.test'],
    ['a', 'analyst.a@kiwanja.test'],
    ['b', 'analyst.b@kiwanja.test'],
    ['sup', 'supervisor@kiwanja.test'],
    ['fan', 'fan@kiwanja.test'],
  ]) {
    const r = await request(app).post('/api/auth/login').send({ email, password: 'kiwanja123' });
    expect(r.status).toBe(200);
    tokens[who] = r.body.token;
  }
  socket = ioClient(`http://localhost:${(server.address() as AddressInfo).port}`, { path: '/socket.io', transports: ['websocket'], auth: { token: tokens.fan } });
  await new Promise<void>((r) => socket.on('connect', () => r()));
});

afterAll(async () => {
  socket?.disconnect();
  closeRealtime();
  await new Promise((r) => server.close(r));
  await prisma.$disconnect();
});

describe('Section 15: live goal demonstration', () => {
  it('1. administrator creates a fixture', async () => {
    const fan = await prisma.user.findUniqueOrThrow({ where: { email: 'fan@kiwanja.test' }, include: { fantasyTeams: { include: { squad: { include: { player: true } } } } } });
    const team = fan.fantasyTeams[0];
    ctx.fanTeamId = team.id;
    // Use a starting midfielder from the demo fan's squad as the scorer.
    const scorerPick = team.squad.find((s) => s.slot <= 11 && s.player.position === 'MID')!;
    ctx.scorer = scorerPick.playerId;
    ctx.homeClubId = scorerPick.player.clubId;
    const away = await prisma.club.findFirstOrThrow({ where: { id: { not: ctx.homeClubId } } });
    ctx.awayClubId = away.id;
    const gw = await prisma.gameweek.findFirstOrThrow({ where: { status: 'UPCOMING' }, orderBy: { number: 'asc' } });
    ctx.gameweekId = gw.id;
    const comp = await prisma.competition.findFirstOrThrow();
    const r = await post('admin', '/ops/football/fixtures', { homeClubId: ctx.homeClubId, awayClubId: ctx.awayClubId, kickoffAt: new Date().toISOString(), gameweekId: gw.id, competitionId: comp.id, origin: 'MANUAL' });
    expect(r.status).toBe(201);
    ctx.fixtureId = r.body.id;
  });

  it('2. administrator registers both line-ups and assigns two analysts', async () => {
    for (const [side, clubId] of [
      ['HOME', ctx.homeClubId],
      ['AWAY', ctx.awayClubId],
    ] as const) {
      const ps = await prisma.player.findMany({ where: { clubId }, orderBy: { price: 'desc' } });
      const pick = (pos: string, n: number) => ps.filter((p) => p.position === pos).slice(0, n);
      const xiPlayers = [...pick('GK', 1), ...pick('DEF', 4), ...pick('MID', 4), ...pick('FWD', 2)];
      if (side === 'HOME' && !xiPlayers.some((p) => p.id === ctx.scorer)) {
        const i = xiPlayers.findIndex((p) => p.position === 'MID');
        xiPlayers[i] = ps.find((p) => p.id === ctx.scorer)!;
      }
      const subs = ps.filter((p) => !xiPlayers.includes(p)).slice(0, 7);
      const r = await request(app)
        .put(`/api/ops/football/fixtures/${ctx.fixtureId}/lineup`)
        .set(auth('admin'))
        .send({ side, players: [...xiPlayers.map((p) => ({ playerId: p.id, isStarter: true })), ...subs.map((p) => ({ playerId: p.id, isStarter: false }))] });
      expect(r.status).toBe(200);
      if (side === 'HOME') {
        ctx.homeGk = xiPlayers.find((p) => p.position === 'GK')!.id;
        ctx.assister = xiPlayers.find((p) => p.position === 'FWD')!.id;
        ctx.homeDef = xiPlayers.find((p) => p.position === 'DEF')!.id;
        ctx.sub = subs.find((p) => p.position === 'MID' || p.position === 'FWD')!.id;
      } else {
        ctx.awayGk = xiPlayers.find((p) => p.position === 'GK')!.id;
        ctx.carded = xiPlayers.filter((p) => p.position === 'DEF')[0].id;
        ctx.sentOff = xiPlayers.filter((p) => p.position === 'DEF')[1].id;
      }
    }
    const [a, b] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { email: 'analyst.a@kiwanja.test' } }), prisma.user.findUniqueOrThrow({ where: { email: 'analyst.b@kiwanja.test' } })]);
    expect((await post('admin', `/ops/football/fixtures/${ctx.fixtureId}/assignments`, { userId: a.id, role: 'PRIMARY' })).status).toBe(200);
    expect((await post('admin', `/ops/football/fixtures/${ctx.fixtureId}/assignments`, { userId: b.id, role: 'VERIFIER' })).status).toBe(200);
  });

  it('3. analyst opens the match and kicks off (the gameweek starts and line-ups freeze)', async () => {
    const r = await get('a', `/ops/matches/${ctx.fixtureId}`);
    expect(r.status).toBe(200);
    expect(r.body.squad).toHaveLength(36);
    const k = await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('MATCH_START', 0));
    expect(k.status).toBe(201);
    const gw = await prisma.gameweek.findUniqueOrThrow({ where: { id: ctx.gameweekId } });
    expect(gw.status).toBe('LIVE');
    expect(await prisma.fantasyGameweekPick.count({ where: { teamId: ctx.fanTeamId, gameweekId: ctx.gameweekId } })).toBe(15);
    // Starters already have an appearance point.
    expect((await points(ctx.scorer))?.provisionalPoints).toBe(1);
  });

  it('4-11. analyst A records a goal; provisional points, team total, leaderboard and match centre update in real time', async () => {
    const before = await fanTeam();
    const matchUpdate = new Promise<{ fixture: { homeScore: number } }>((resolve) => socket.once('match:update', resolve));
    const leaderboard = new Promise((resolve) => socket.once('leaderboard:update', resolve));
    const notification = new Promise<{ title: string }>((resolve) => socket.once('notification', resolve));
    socket.emit('match:join', ctx.fixtureId);
    await new Promise((r) => setTimeout(r, 100));

    const r = await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('GOAL', 12, { side: 'HOME', playerId: ctx.scorer, secondaryPlayerId: ctx.assister }));
    expect(r.status).toBe(201);
    expect(r.body.event.status).toBe('PENDING'); // awaiting analyst B

    // Real-time pushes reached a connected fantasy user.
    expect((await matchUpdate).fixture.homeScore).toBe(1);
    await leaderboard;
    expect((await notification).title).toMatch(/Goal 12'/);

    // Scoring engine: MID goal = 5 + appearance 1. Confirmed points wait for verification.
    const p = await points(ctx.scorer);
    expect(p?.provisionalPoints).toBe(6);
    expect(p?.confirmedPoints).toBe(1);
    expect((p?.provisionalBreakdown as { code: string }[]).map((l) => l.code)).toEqual(['APPEARANCE_SHORT', 'GOAL']);
    expect((await points(ctx.assister))?.provisionalPoints).toBe(1 + 3);

    // The fan's team and total update (captain doubles if the scorer wears the armband).
    const pick = await prisma.fantasyGameweekPick.findFirstOrThrow({ where: { teamId: ctx.fanTeamId, gameweekId: ctx.gameweekId, playerId: ctx.scorer } });
    const after = await fanTeam();
    expect(after.totalPoints - before.totalPoints).toBeGreaterThanOrEqual(5 * (pick.isCaptain ? 2 : 1));

    // Overall leaderboard reads the new total.
    const board = await get(null, '/leagues/overall?limit=200');
    expect(board.body.rows.find((x: { teamId: string }) => x.teamId === ctx.fanTeamId).totalPoints).toBe(after.totalPoints);

    // Match centre shows the goal.
    const mc = await get(null, `/matches/${ctx.fixtureId}`);
    expect(mc.body.fixture.homeScore).toBe(1);
    expect(mc.body.events.some((e: { code: string; playerId: string }) => e.code === 'GOAL' && e.playerId === ctx.scorer)).toBe(true);
  });

  it('5. analyst A cannot verify their own event; analyst B verifies it and points are confirmed', async () => {
    const goal = await prisma.matchEvent.findFirstOrThrow({ where: { fixtureId: ctx.fixtureId, code: 'GOAL' } });
    expect((await post('a', `/ops/matches/events/${goal.id}/verify`, { decision: 'CONFIRM' })).status).toBe(403);
    const r = await post('b', `/ops/matches/events/${goal.id}/verify`, { decision: 'CONFIRM' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('VERIFIED');
    expect((await points(ctx.scorer))?.confirmedPoints).toBe(6);
    expect((await fanScore())!.confirmedPoints).toBeGreaterThan(0);
  });

  it('12. administrator inspects the event and its verification history', async () => {
    const goal = await prisma.matchEvent.findFirstOrThrow({ where: { fixtureId: ctx.fixtureId, code: 'GOAL' } });
    const r = await get('admin', `/ops/matches/events/${goal.id}/history`);
    expect(r.status).toBe(200);
    expect(r.body.event.recordedBy.displayName).toMatch(/Analyst/);
    expect(r.body.event.verifications.map((v: { decision: string }) => v.decision)).toEqual(['CONFIRM']);
    expect(r.body.audit.map((a: { action: string }) => a.action)).toEqual(['event.create', 'event.confirm']);
  });
});

describe('duplicate prevention and offline sync', () => {
  it('replaying the same device event id never creates a second event', async () => {
    const e = ev('SHOT_ON_TARGET', 20, { side: 'HOME', playerId: ctx.scorer });
    expect((await post('a', `/ops/matches/${ctx.fixtureId}/events`, e)).status).toBe(201);
    const again = await post('a', `/ops/matches/${ctx.fixtureId}/events`, e);
    expect(again.status).toBe(200);
    expect(again.body.outcome).toBe('replayed');
    expect(await prisma.matchEvent.count({ where: { fixtureId: ctx.fixtureId, code: 'SHOT_ON_TARGET' } })).toBe(1);
    // Shot on target: +1 (experimental rule, auto-verified so confirmed immediately).
    expect((await points(ctx.scorer))?.confirmedPoints).toBe(7);
  });

  it('flags a near-identical goal as a possible duplicate', async () => {
    const r = await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('GOAL', 13, { side: 'HOME', playerId: ctx.scorer }));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('POSSIBLE_DUPLICATE');
  });

  it('syncs an offline queue with per-event results', async () => {
    const queued = [ev('SAVE', 21, { side: 'AWAY', playerId: ctx.awayGk }), ev('SAVE', 22, { side: 'AWAY', playerId: ctx.awayGk }), ev('SAVE', 23, { side: 'AWAY', playerId: ctx.awayGk })];
    const first = await post('a', `/ops/matches/${ctx.fixtureId}/events/sync`, { events: [queued[0]] });
    expect(first.body.results[0].outcome).toBe('created');
    // Connection dropped before the client saw the response: it resends everything.
    const r = await post('a', `/ops/matches/${ctx.fixtureId}/events/sync`, { events: queued });
    expect(r.body.results.map((x: { outcome: string }) => x.outcome)).toEqual(['replayed', 'created', 'created']);
    expect(await prisma.matchEvent.count({ where: { fixtureId: ctx.fixtureId, code: 'SAVE' } })).toBe(3);
    // Device timestamps are preserved.
    const saved = await prisma.matchEvent.findUniqueOrThrow({ where: { clientEventId: queued[1].clientEventId } });
    expect(saved.clientRecordedAt.toISOString()).toBe(queued[1].clientRecordedAt);
    // Goalkeeper save rule: every 3 saves = +1.
    expect((await points(ctx.awayGk))?.provisionalBreakdown).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SAVES', points: 1 })]));
  });
});

describe('cards, substitutions, corrections and clean sheets', () => {
  it('yellow card -1, red card -3 and the player leaves the pitch', async () => {
    expect((await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('YELLOW_CARD', 30, { side: 'AWAY', playerId: ctx.carded }))).status).toBe(201);
    expect((await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('RED_CARD', 35, { side: 'AWAY', playerId: ctx.sentOff }))).status).toBe(201);
    expect((await points(ctx.carded))?.provisionalPoints).toBe(1 - 1);
    expect((await points(ctx.sentOff))?.provisionalPoints).toBe(1 - 3);
    // A sent-off player cannot be logged again (not on the pitch for the console), and stats stop at 35'.
    const stat = await prisma.playerMatchStat.findUniqueOrThrow({ where: { fixtureId_playerId_basis: { fixtureId: ctx.fixtureId, playerId: ctx.sentOff, basis: 'PROVISIONAL' } } });
    expect(stat.minutes).toBe(35);
  });

  it('substitution: the player coming on gets an appearance', async () => {
    await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('HALF_TIME', 45));
    await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('SECOND_HALF_START', 45));
    const r = await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('SUBSTITUTION', 60, { side: 'HOME', playerId: ctx.assister, secondaryPlayerId: ctx.sub }));
    expect(r.status).toBe(201);
    const p = await points(ctx.sub);
    expect(p?.minutes).toBeGreaterThanOrEqual(1);
    expect(p?.provisionalPoints).toBe(1);
  });

  it('corrections: wrong scorer is disputed, corrected by a supervisor, and points move', async () => {
    const wrong = await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('GOAL', 70, { side: 'HOME', playerId: ctx.homeDef }));
    expect((await points(ctx.homeDef))?.provisionalPoints).toBe(1 + 6 - 0); // DEF goal = 6
    const id = wrong.body.event.id;
    expect((await post('b', `/ops/matches/events/${id}/verify`, { decision: 'DISPUTE', note: 'Scorer was the midfielder' })).body.status).toBe('DISPUTED');
    // Stale version is rejected (conflicting edit from another device).
    const stale = await post('sup', `/ops/matches/events/${id}/correct`, { expectedVersion: 99, reason: 'fix scorer', changes: { playerId: ctx.scorer } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    // Analyst B (not the recorder, not a supervisor) may not correct.
    expect((await post('b', `/ops/matches/events/${id}/correct`, { expectedVersion: 1, reason: 'fix scorer', changes: { playerId: ctx.scorer } })).status).toBe(403);
    const fixed = await post('sup', `/ops/matches/events/${id}/correct`, { expectedVersion: 1, reason: 'Video review: scorer was the midfielder', changes: { playerId: ctx.scorer, minute: 71 } });
    expect(fixed.status).toBe(200);
    expect(fixed.body.version).toBe(2);
    expect(fixed.body.status).toBe('VERIFIED');
    expect((await points(ctx.homeDef))?.provisionalBreakdown).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'GOAL' })]));
    const s = await points(ctx.scorer);
    expect((s?.provisionalBreakdown as { code: string; value: number }[]).find((l) => l.code === 'GOAL')?.value).toBe(2);
    const history = await get('admin', `/ops/matches/events/${id}/history`);
    expect(history.body.event.corrections).toHaveLength(1);
    expect(history.body.event.corrections[0].before.playerId).toBe(ctx.homeDef);
  });

  it('full-time: clean sheet for the home goalkeeper, goals conceded for the away keeper', async () => {
    await post('a', `/ops/matches/${ctx.fixtureId}/events`, ev('FULL_TIME', 90));
    const gk = await points(ctx.homeGk);
    expect(gk?.minutes).toBe(90);
    expect(gk?.provisionalBreakdown).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'CLEAN_SHEET', points: 4 }), expect.objectContaining({ code: 'APPEARANCE_FULL', points: 2 })]));
    const away = await points(ctx.awayGk);
    expect(away?.provisionalBreakdown).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'GOALS_CONCEDED', points: -1 })]));
  });

  it('publishing requires every event to be verified', async () => {
    expect((await post('a', `/ops/matches/${ctx.fixtureId}/complete`)).status).toBe(200);
    const blocked = await post('sup', `/ops/matches/${ctx.fixtureId}/publish`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('UNVERIFIED_EVENTS');
    const pending = await prisma.matchEvent.findMany({ where: { fixtureId: ctx.fixtureId, status: 'PENDING' } });
    for (const e of pending) expect((await post('b', `/ops/matches/events/${e.id}/verify`, { decision: 'CONFIRM' })).status).toBe(200);
    expect((await post('sup', `/ops/matches/${ctx.fixtureId}/publish`)).status).toBe(200);
    const p = await points(ctx.scorer);
    expect(p?.confirmedPoints).toBe(p?.provisionalPoints);
  });
});

describe('configurable scoring and permissions', () => {
  it('changing a rule recalculates points without code changes', async () => {
    const before = (await points(ctx.scorer))!.provisionalPoints;
    const rule = await prisma.scoringRule.findUniqueOrThrow({ where: { code: 'GOAL' } });
    const body = (mid: number) => ({ label: rule.label, statKey: rule.statKey, mode: rule.mode, unit: rule.unit, min: rule.min, max: rule.max, minMinutes: rule.minMinutes, points: { GK: rule.pointsGK, DEF: rule.pointsDEF, MID: mid, FWD: rule.pointsFWD }, enabled: true });
    expect((await request(app).put('/api/ops/fantasy/scoring-rules/GOAL').set(auth('admin')).send(body(7))).status).toBe(200);
    expect((await points(ctx.scorer))!.provisionalPoints).toBe(before + 2 * 2); // two goals, +2 each
    await request(app).put('/api/ops/fantasy/scoring-rules/GOAL').set(auth('admin')).send(body(5));
    expect((await points(ctx.scorer))!.provisionalPoints).toBe(before);
  });

  it('ordinary users cannot reach administrator or analyst functions', async () => {
    expect((await get('fan', '/ops/overview')).status).toBe(403);
    expect((await post('fan', `/ops/matches/${ctx.fixtureId}/events`, ev('GOAL', 80, { side: 'HOME', playerId: ctx.scorer }))).status).toBe(403);
    expect((await request(app).put('/api/ops/fantasy/scoring-rules/GOAL').set(auth('fan')).send({})).status).toBe(403);
    expect((await get(null, '/ops/overview')).status).toBe(401);
    // Analysts cannot manage fixtures or scoring.
    expect((await post('a', '/ops/football/fixtures', {})).status).toBe(403);
  });

  it('analysts cannot log events for matches they are not assigned to', async () => {
    const other = await prisma.fixture.findFirstOrThrow({ where: { status: 'SCHEDULED', assignments: { none: {} } } });
    expect((await post('a', `/ops/matches/${other.id}/events`, ev('MATCH_START', 0))).status).toBe(403);
  });
});
