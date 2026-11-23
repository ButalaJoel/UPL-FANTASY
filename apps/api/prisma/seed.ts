/**
 * Demonstration data. EVERYTHING here is fictional and marked origin = SAMPLE.
 * No real UPL clubs, players or statistics are created. Real historical data can be
 * imported later with origin = IMPORTED / MANUAL and its own data source.
 *
 * Run: pnpm db:seed   (or pnpm db:reset to wipe and re-seed)
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { DEFAULT_GAME_RULES, DEFAULT_SCORING_RULES, EVENT_TYPES, defaultLineup, roundRobin, seededRandom, shuffle, validateSquad, type Position, type SquadPlayer } from '@kiwanja/core';
import { PrismaClient, type Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const rand = seededRandom(20261123);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
const poisson = (l: number) => {
  let k = 0;
  let p = 1;
  const L = Math.exp(-l);
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
};

const CLUBS = [
  ['Kololo Rangers', 'KOL', 'Kampala', 'Kololo Grounds', '#0E7C66', '#F2C14E'],
  ['Nile Delta FC', 'NDF', 'Jinja', 'Source Park', '#1D4E89', '#F7F7F2'],
  ['Lakeside Entebbe', 'LKE', 'Entebbe', 'Shoreline Arena', '#2A9D8F', '#264653'],
  ['Ankole Highlanders', 'ANK', 'Mbarara', 'Kakoba Hill Ground', '#8C1C13', '#F4D35E'],
  ['Northern Stars Gulu', 'NSG', 'Gulu', 'Acholi Fields', '#3D348B', '#F18701'],
  ['Elgon United', 'ELG', 'Mbale', 'Wanale View Stadium', '#2B9348', '#FFFFFF'],
  ['Masaka Coffee FC', 'MCF', 'Masaka', 'Bean Park', '#6F4518', '#E9C46A'],
  ['Crater Lakes FC', 'CRL', 'Fort Portal', 'Rwenzori Oval', '#00A6A6', '#0B132B'],
  ['Kigezi Hills', 'KGZ', 'Kabale', 'Bunyonyi Ground', '#386641', '#F2E8CF'],
  ['Savannah Lira', 'SVL', 'Lira', 'Lango Plains Park', '#BC6C25', '#283618'],
  ['Mukono Thunder', 'MKT', 'Mukono', 'Thunder Dome', '#5F0F40', '#FB8B24'],
  ['Wakiso Comets', 'WKC', 'Wakiso', 'Comet Field', '#0F4C5C', '#E36414'],
  ['Bunyoro Oil City', 'BOC', 'Hoima', 'Refinery Road Ground', '#14213D', '#FCA311'],
  ['West Nile Riverside', 'WNR', 'Arua', 'Riverside Park', '#3A86FF', '#FFBE0B'],
  ['Teso Eagles', 'TSE', 'Soroti', 'Rock View Ground', '#9D0208', '#FFBA08'],
  ['Busoga Sugar FC', 'BSF', 'Kamuli', 'Cane Fields Arena', '#55A630', '#1B1B1E'],
] as const;

// Name pools are combined at random: the resulting players are fictional.
const FIRST = ['Abdul', 'Allan', 'Amos', 'Andrew', 'Arthur', 'Ashraf', 'Bashir', 'Benjamin', 'Brian', 'Charles', 'Collins', 'Daniel', 'David', 'Denis', 'Derrick', 'Edward', 'Emmanuel', 'Eric', 'Fahad', 'Frank', 'Fred', 'Geoffrey', 'George', 'Godfrey', 'Hakim', 'Henry', 'Herbert', 'Ibrahim', 'Isaac', 'Ivan', 'Jacob', 'James', 'Joel', 'John', 'Jonah', 'Joseph', 'Julius', 'Karim', 'Kenneth', 'Lawrence', 'Martin', 'Moses', 'Musa', 'Nathan', 'Nicholas', 'Noah', 'Oscar', 'Patrick', 'Paul', 'Peter', 'Phillip', 'Richard', 'Robert', 'Ronald', 'Samuel', 'Shafik', 'Simon', 'Solomon', 'Steven', 'Timothy', 'Tonny', 'Umar', 'Vincent', 'William', 'Yasin', 'Yusuf'];
const LAST = ['Achaye', 'Agaba', 'Akena', 'Akol', 'Alinda', 'Amanya', 'Amone', 'Asiimwe', 'Atuhaire', 'Bainomugisha', 'Bakaki', 'Balikuddembe', 'Baluku', 'Byaruhanga', 'Ddamba', 'Ekwang', 'Emuge', 'Etyang', 'Gumisiriza', 'Isabirye', 'Kabugo', 'Kagwa', 'Kakooza', 'Kalanzi', 'Kasozi', 'Katende', 'Kayemba', 'Kibuuka', 'Kiggundu', 'Kiwanuka', 'Kizito', 'Lubega', 'Lukwago', 'Lutaaya', 'Magezi', 'Mayanja', 'Mbabazi', 'Mpagi', 'Mugisha', 'Mukasa', 'Mulindwa', 'Muwanga', 'Mwesigwa', 'Nabende', 'Nakibinge', 'Nsubuga', 'Nyanzi', 'Obbo', 'Ochieng', 'Odongo', 'Ogwang', 'Okello', 'Okot', 'Olupot', 'Omara', 'Onyango', 'Opio', 'Otim', 'Owino', 'Sekandi', 'Semakula', 'Ssali', 'Ssebuliba', 'Ssekitto', 'Ssemanda', 'Tumusiime', 'Tumwine', 'Turyamureeba', 'Wafula', 'Walusimbi', 'Wasswa', 'Waiswa'];

const SQUAD_SHAPE: [Position, number, [number, number]][] = [
  ['GK', 3, [40, 55]],
  ['DEF', 6, [40, 65]],
  ['MID', 6, [45, 100]],
  ['FWD', 3, [45, 110]],
];

async function main() {
  if ((await prisma.user.count()) > 0 && !process.argv.includes('--force')) {
    console.log('Database already has data. Use `pnpm db:reset` to wipe and re-seed.');
    return;
  }
  // Services import the shared prisma client; load them lazily after the guard.
  const { startGameweek, lockGameweek } = await import('../src/services/gameweeks.js');
  const { recomputeFixture } = await import('../src/services/scoringPipeline.js');
  const { createCup } = await import('../src/services/leagues.js');

  console.log('Seeding reference data...');
  await prisma.eventType.createMany({
    data: EVENT_TYPES.map((e, i) => ({ code: e.code, label: e.label, category: e.category, needsPlayer: e.needsPlayer, requiresVerification: e.requiresVerification, extended: !!e.extended, description: e.description, sortOrder: i })),
  });
  await prisma.scoringRule.createMany({
    data: DEFAULT_SCORING_RULES.map((r) => ({ code: r.code, label: r.label, statKey: r.statKey, mode: r.mode, unit: r.unit, min: r.min, max: r.max, minMinutes: r.minMinutes, pointsGK: r.points.GK, pointsDEF: r.points.DEF, pointsMID: r.points.MID, pointsFWD: r.points.FWD, enabled: r.enabled, experimental: !!r.experimental, sortOrder: r.sortOrder, description: r.description })),
  });
  await prisma.appSetting.create({ data: { key: 'gameRules', value: DEFAULT_GAME_RULES as unknown as Prisma.InputJsonValue } });

  const [liveSource, sampleSource] = await Promise.all([
    prisma.dataSource.create({ data: { name: 'Kiwanja match analysts (live)', kind: 'MANUAL_LIVE', attribution: 'Collected by Kiwanja analysts', notes: 'Two-analyst live collection with supervisor review.' } }),
    prisma.dataSource.create({ data: { name: 'Fictional sample data', kind: 'SAMPLE', attribution: 'Generated for demonstration. Not real players or results.', notes: 'Every club, player, fixture and event from this source is fictional.' } }),
    prisma.dataSource.create({
      data: {
        name: 'Published UPL match reports (manual historical entry)',
        kind: 'MANUAL_HISTORICAL',
        attribution: 'Transcribed from publicly published official match reports',
        notes: 'Fields seen in published reports: score, teams, starting XI, scorers, goal minutes, assists, cards, substitutions, Man of the Match. Confirm data rights with UPL/FUFA before commercial use. Do not scrape.',
        active: true,
      },
    }),
    prisma.dataSource.create({ data: { name: 'Wearable tracking prototype (R&D)', kind: 'TRACKING_DEVICE', active: false, notes: 'Placeholder for future ESP32 + GNSS/IMU experiments. Accuracy unvalidated: never use for scoring.' } }),
  ]);

  console.log('Seeding users...');
  const hash = await bcrypt.hash('kiwanja123', 10);
  const staff = await Promise.all(
    [
      ['admin@kiwanja.test', 'Ada Admin', 'SUPER_ADMIN'],
      ['competition@kiwanja.test', 'Cosmas Competitions', 'COMPETITION_ADMIN'],
      ['supervisor@kiwanja.test', 'Sarah Supervisor', 'MATCH_SUPERVISOR'],
      ['analyst.a@kiwanja.test', 'Aisha Analyst (A)', 'MATCH_ANALYST'],
      ['analyst.b@kiwanja.test', 'Ben Verifier (B)', 'MATCH_ANALYST'],
    ].map(([email, displayName, role]) => prisma.user.create({ data: { email, displayName, role: role as never, passwordHash: hash, isSample: true, avatarColor: '#0E7C66' } })),
  );
  const [, , , analystA, analystB] = staff;

  const competition = await prisma.competition.create({ data: { name: 'Sample Premier League', shortName: 'SPL', origin: 'SAMPLE' } });
  const season = await prisma.season.create({ data: { competitionId: competition.id, name: '2026/27 (sample)', startDate: new Date('2026-11-01'), endDate: new Date('2027-05-31'), isCurrent: true } });

  console.log('Seeding 16 fictional clubs and 288 fictional players...');
  const clubs = [];
  const usedNames = new Set<string>();
  for (const [name, shortName, city, stadium, primaryColor, secondaryColor] of CLUBS) {
    const club = await prisma.club.create({ data: { name, shortName, city, stadium, primaryColor, secondaryColor, origin: 'SAMPLE', sourceId: sampleSource.id } });
    const players: Prisma.PlayerCreateManyInput[] = [];
    let shirt = 1;
    for (const [position, count, [lo, hi]] of SQUAD_SHAPE) {
      for (let i = 0; i < count; i++) {
        let first: string, last: string;
        do {
          first = pick(FIRST);
          last = pick(LAST);
        } while (usedNames.has(`${first} ${last}`));
        usedNames.add(`${first} ${last}`);
        // Better players (first in each group) cost more.
        const quality = i === 0 ? 0.75 + rand() * 0.25 : rand() * 0.7;
        const price = Math.round((lo + (hi - lo) * quality) / 5) * 5;
        players.push({ firstName: first, lastName: last, clubId: club.id, position, shirtNumber: position === 'GK' ? [1, 18, 30][i] : (shirt = shirt + 1 + (shirt === 17 ? 1 : 0)), price, origin: 'SAMPLE', sourceId: sampleSource.id, nationality: 'Uganda', status: rand() < 0.04 ? 'INJURED' : rand() < 0.04 ? 'DOUBTFUL' : 'AVAILABLE' });
      }
    }
    await prisma.player.createMany({ data: players });
    clubs.push(club);
  }
  const allPlayers = await prisma.player.findMany();

  console.log('Seeding 30 gameweeks and 240 fixtures...');
  const rounds = roundRobin(clubs.map((c) => c.id), 15);
  const schedule = [...rounds, ...rounds.map((r) => r.map(([a, b]) => [b, a] as [string | null, string | null]))];
  const gw1Deadline = new Date('2026-11-07T11:00:00Z');
  const gameweeks = [];
  for (let i = 0; i < schedule.length; i++) {
    const deadline = new Date(gw1Deadline.getTime() + i * 7 * 86400_000);
    // Shift so gameweek 3 is the one coming up this week.
    if (i >= 2) deadline.setTime(new Date('2026-11-28T11:00:00Z').getTime() + (i - 2) * 7 * 86400_000);
    const gw = await prisma.gameweek.create({ data: { seasonId: season.id, number: i + 1, name: `Gameweek ${i + 1}`, deadlineAt: deadline } });
    gameweeks.push(gw);
    for (const [j, [home, away]] of schedule[i].entries()) {
      const kickoff = new Date(deadline.getTime() + (2 + (j % 3)) * 3600_000 + Math.floor(j / 3) * 86400_000);
      const homeClub = clubs.find((c) => c.id === home)!;
      await prisma.fixture.create({ data: { seasonId: season.id, competitionId: competition.id, gameweekId: gw.id, homeClubId: home!, awayClubId: away!, kickoffAt: kickoff, venue: homeClub.stadium, origin: 'SAMPLE', sourceId: sampleSource.id } });
    }
  }

  console.log('Seeding sample fantasy managers...');
  const overall = await prisma.fantasyLeague.create({ data: { seasonId: season.id, name: 'Overall', type: 'CLASSIC', visibility: 'PUBLIC', code: 'OVERALL', isSystem: true } });
  const publicLeague = await prisma.fantasyLeague.create({ data: { seasonId: season.id, name: 'Kampala Supporters', type: 'CLASSIC', visibility: 'PUBLIC', code: 'KLAFANS', ownerId: staff[1].id } });
  const office = await prisma.fantasyLeague.create({ data: { seasonId: season.id, name: 'Nakasero Office League', type: 'CLASSIC', visibility: 'PRIVATE', code: 'NKS2026' } });
  const h2h = await prisma.fantasyLeague.create({ data: { seasonId: season.id, name: 'Boda Boda H2H', type: 'H2H', visibility: 'PRIVATE', code: 'BODAH2H', startGameweek: 1 } });

  const managerNames = ['Grace N.', 'Ivan K.', 'Patience A.', 'Ronald M.', 'Sharon T.', 'Moses O.', 'Esther B.', 'Kenneth W.', 'Juliet S.', 'Hassan L.', 'Doreen K.', 'Brian O.', 'Faith A.', 'Isaac M.', 'Prossy N.', 'Jonah E.', 'Agnes P.', 'Collins T.', 'Mercy W.', 'Edgar B.', 'Ruth K.', 'Tonny S.', 'Winnie O.', 'Fred A.', 'Lydia M.', 'Samuel G.', 'Brenda J.', 'Arnold K.', 'Christine L.', 'Derrick N.', 'Eva R.', 'Paul Z.', 'Rita O.', 'Victor H.', 'Sylvia D.', 'Martin C.', 'Joan F.', 'Peter Q.', 'Annet U.', 'Hillary V.'];
  const teamWords = ['Crested Cranes', 'Pearl Strikers', 'Matooke Masters', 'Rolex XI', 'Boda Ballers', 'Nile Perch', 'Kasuku Kings', 'Enkoko Elite', 'Taxi Park Tigers', 'Owino Wanderers', 'Nakivubo Nostalgia', 'Mengo Mighty', 'Kabaka Kickers', 'Gulu Gunners', 'Jinja Juggernauts', 'Muzungu Magic', 'Chapati Chasers', 'Luwombo Lions', 'Kikomando FC', 'Ssese Sailors'];
  const rules = DEFAULT_GAME_RULES;
  const squadFor = (): SquadPlayer[] => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const chosen: SquadPlayer[] = [];
      let budget = rules.squad.budget;
      const need = { ...rules.squad.composition };
      let remaining = rules.squad.size;
      const pool = shuffle(allPlayers.filter((p) => p.status === 'AVAILABLE'), rand);
      for (const pos of ['FWD', 'MID', 'DEF', 'GK'] as Position[]) {
        for (const p of pool) {
          if (need[pos] === 0) break;
          if (p.position !== pos || chosen.some((c) => c.playerId === p.id)) continue;
          if (chosen.filter((c) => c.clubId === p.clubId).length >= rules.squad.maxPerClub) continue;
          if (budget - p.price < (remaining - 1) * 42) continue;
          chosen.push({ playerId: p.id, position: p.position as Position, clubId: p.clubId, price: p.price });
          budget -= p.price;
          need[pos] -= 1;
          remaining -= 1;
        }
      }
      if (!validateSquad(chosen, rules).length) return chosen;
    }
    throw new Error('Could not build a random squad');
  };

  const fan = await prisma.user.create({ data: { email: 'fan@kiwanja.test', displayName: 'Demo Fan', passwordHash: hash, isSample: true, avatarColor: '#E36414' } });
  const managers = [fan, ...(await Promise.all(managerNames.map((n, i) => prisma.user.create({ data: { email: `manager${i + 1}@kiwanja.test`, displayName: n, passwordHash: hash, isSample: true, avatarColor: pick(['#0E7C66', '#1D4E89', '#8C1C13', '#3D348B', '#BC6C25', '#5F0F40', '#E36414']) } }))))];
  const teams = [];
  for (const [i, m] of managers.entries()) {
    const squad = squadFor();
    const lineup = defaultLineup(squad, rules);
    const cost = squad.reduce((s, p) => s + p.price, 0);
    const team = await prisma.fantasyTeam.create({
      data: {
        userId: m.id,
        seasonId: season.id,
        name: i === 0 ? 'Demo Fan XI' : `${teamWords[i % teamWords.length]}${i >= teamWords.length ? ' II' : ''}`,
        bank: rules.squad.budget - cost,
        freeTransfers: 0,
        origin: 'SAMPLE',
        squad: { create: lineup.map((l) => ({ playerId: l.playerId, purchasePrice: squad.find((s) => s.playerId === l.playerId)!.price, slot: l.slot, isCaptain: l.isCaptain, isViceCaptain: l.isViceCaptain })) },
      },
    });
    teams.push(team);
    const memberships = [overall.id, ...(i % 3 === 0 ? [publicLeague.id] : []), ...(i < 10 ? [office.id] : []), ...(i < 7 ? [h2h.id] : [])];
    await prisma.leagueMember.createMany({ data: memberships.map((leagueId) => ({ leagueId, teamId: team.id })) });
  }

  console.log('Playing gameweeks 1 and 2 with fictional events...');
  for (const gw of gameweeks.slice(0, 2)) {
    await startGameweek(gw.id, null);
    const fixtures = await prisma.fixture.findMany({ where: { gameweekId: gw.id } });
    for (const f of fixtures) await playSampleMatch(f.id, f.homeClubId, f.awayClubId, analystA.id, analystB.id, sampleSource.id);
    for (const f of fixtures) await recomputeFixture(f.id, { cascade: false });
    await lockGameweek(gw.id, staff[0].id);
  }

  // A few sample transfers for gameweek 3 so transfer history and price changes have data.
  const { transfers } = await import('../src/services/fantasy.js');
  for (const t of teams.slice(1, 12)) {
    const squad = await prisma.fantasySquadPlayer.findMany({ where: { teamId: t.id }, include: { player: true } });
    const out = pick(squad.filter((s) => s.player.position !== 'GK'));
    const candidates = allPlayers.filter((p) => p.position === out.player.position && p.price <= out.player.price + t.bank && !squad.some((s) => s.playerId === p.id));
    const clubCounts = new Map<string, number>();
    for (const s of squad) if (s.playerId !== out.playerId) clubCounts.set(s.player.clubId, (clubCounts.get(s.player.clubId) ?? 0) + 1);
    const inn = candidates.find((p) => (clubCounts.get(p.clubId) ?? 0) < 3);
    if (inn) await transfers(t.userId, [{ outId: out.playerId, inId: inn.id }], false, true).catch(() => undefined);
  }

  // Gameweek 3: assign both analysts to every fixture, ready for the live demo.
  const gw3 = gameweeks[2];
  const gw3Fixtures = await prisma.fixture.findMany({ where: { gameweekId: gw3.id } });
  await prisma.analystAssignment.createMany({ data: gw3Fixtures.flatMap((f) => [{ fixtureId: f.id, userId: analystA.id, role: 'PRIMARY' as const }, { fixtureId: f.id, userId: analystB.id, role: 'VERIFIER' as const }]) });

  await createCup({ name: 'Kiwanja Knockout Cup', startGameweek: 4, maxEntrants: 16, method: 'SEEDED' });

  console.log('\nSeed complete. All data is fictional (origin SAMPLE).');
  console.log('Sign in with any of these (password: kiwanja123):');
  for (const u of [...staff, fan]) console.log(`  ${u.role.padEnd(18)} ${u.email}`);
}

/** Fictional match: line-ups, goals, assists, cards, substitutions, saves and shots. */
async function playSampleMatch(fixtureId: string, homeId: string, awayId: string, recorderId: string, verifierId: string, sourceId: string) {
  const sides = [
    ['HOME', homeId],
    ['AWAY', awayId],
  ] as const;
  const squads: Record<'HOME' | 'AWAY', { starters: { id: string; position: string }[]; bench: { id: string; position: string }[] }> = { HOME: { starters: [], bench: [] }, AWAY: { starters: [], bench: [] } };
  for (const [side, clubId] of sides) {
    const players = await prisma.player.findMany({ where: { clubId }, orderBy: [{ price: 'desc' }] });
    const by = (pos: string) => players.filter((p) => p.position === pos && p.status !== 'INJURED');
    const starters = [...by('GK').slice(0, 1), ...by('DEF').slice(0, 4), ...by('MID').slice(0, 4), ...by('FWD').slice(0, 2)];
    const bench = players.filter((p) => !starters.includes(p) && p.status !== 'INJURED').slice(0, 7);
    squads[side] = { starters: starters.map((p) => ({ id: p.id, position: p.position })), bench: bench.map((p) => ({ id: p.id, position: p.position })) };
    await prisma.matchSquadEntry.createMany({ data: [...starters.map((p) => ({ p, s: true })), ...bench.map((p) => ({ p, s: false }))].map(({ p, s }) => ({ fixtureId, playerId: p.id, side, isStarter: s, shirtNumber: p.shirtNumber, position: p.position })) });
  }

  const f = await prisma.fixture.findUniqueOrThrow({ where: { id: fixtureId } });
  const t0 = f.kickoffAt.getTime();
  const events: Omit<Prisma.MatchEventCreateManyInput, 'fixtureId' | 'sequence' | 'recordedById' | 'clientEventId' | 'clientRecordedAt'>[] = [];
  const add = (code: string, minute: number, side: 'HOME' | 'AWAY' | null, playerId?: string, secondaryPlayerId?: string) => events.push({ code, minute, side, playerId: playerId ?? null, secondaryPlayerId: secondaryPlayerId ?? null, status: 'VERIFIED', origin: 'SAMPLE', sourceId });
  add('MATCH_START', 0, null);
  add('HALF_TIME', 45, null);
  add('SECOND_HALF_START', 45, null);
  for (const side of ['HOME', 'AWAY'] as const) {
    const opp = side === 'HOME' ? 'AWAY' : 'HOME';
    const st = squads[side].starters;
    const outfield = st.filter((p) => p.position !== 'GK');
    const attackers = st.filter((p) => p.position === 'FWD' || p.position === 'MID');
    const goals = poisson(side === 'HOME' ? 1.4 : 1.1);
    for (let g = 0; g < goals; g++) {
      const scorer = rand() < 0.75 ? pick(attackers) : pick(outfield);
      const assist = rand() < 0.7 ? pick(outfield.filter((p) => p.id !== scorer.id)) : undefined;
      add('GOAL', int(3, 89), side, scorer.id, assist?.id);
    }
    for (let s = 0; s < int(1, 4); s++) add('SHOT_ON_TARGET', int(2, 89), side, pick(attackers).id);
    const oppGk = squads[opp].starters.find((p) => p.position === 'GK')!;
    for (let s = 0; s < int(1, 5); s++) add('SAVE', int(2, 89), opp, oppGk.id);
    for (let c = 0; c < int(0, 3); c++) add('YELLOW_CARD', int(10, 88), side, pick(outfield).id);
    if (rand() < 0.06) add('RED_CARD', int(50, 88), side, pick(outfield.slice(0, 4)).id);
    const subsOff = shuffle(outfield, rand).slice(0, 3);
    const subsOn = squads[side].bench.filter((p) => p.position !== 'GK');
    subsOff.forEach((off, k) => {
      const on = subsOn.find((b) => b.position === off.position) ?? subsOn[k];
      if (on) {
        subsOn.splice(subsOn.indexOf(on), 1);
        add('SUBSTITUTION', int(55, 85), side, off.id, on.id);
      }
    });
    if (rand() < 0.3) {
      const all = [...squads[side].starters];
      add('MAN_OF_THE_MATCH', 90, side, pick(all).id);
    }
  }
  add('FULL_TIME', 90, null);
  // Drop events for players already off the pitch (simple sanity pass).
  const offAt = new Map<string, number>();
  for (const e of [...events].sort((a, b) => a.minute - b.minute)) {
    if ((e.code === 'SUBSTITUTION' || e.code === 'RED_CARD') && e.playerId) offAt.set(e.playerId, e.minute);
  }
  const valid = events.filter((e) => !(e.playerId && e.code !== 'SUBSTITUTION' && e.code !== 'RED_CARD' && e.code !== 'MAN_OF_THE_MATCH' && offAt.has(e.playerId) && e.minute > offAt.get(e.playerId)!));
  valid.sort((a, b) => a.minute - b.minute || (a.code === 'MATCH_START' ? -1 : 0));
  const created = await prisma.$transaction(
    valid.map((e, i) =>
      prisma.matchEvent.create({ data: { ...e, fixtureId, sequence: i + 1, recordedById: recorderId, clientEventId: randomUUID(), clientRecordedAt: new Date(t0 + e.minute * 60_000), recordedAt: new Date(t0 + e.minute * 60_000 + 5000), verifiedAt: new Date(t0 + e.minute * 60_000 + 60_000) } }),
    ),
  );
  await prisma.eventVerification.createMany({ data: created.map((e) => ({ eventId: e.id, userId: verifierId, decision: 'CONFIRM' as const, note: 'Sample verification' })) });
  await prisma.fixture.update({ where: { id: fixtureId }, data: { status: 'PUBLISHED', startedAt: new Date(t0), finishedAt: new Date(t0 + 105 * 60_000), completedAt: new Date(t0 + 110 * 60_000), publishedAt: new Date(t0 + 120 * 60_000), periodStartedAt: new Date(t0 + 60 * 60_000) } });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
