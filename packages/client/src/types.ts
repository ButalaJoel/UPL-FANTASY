/** Response shapes of the Kiwanja API, shared by the web and mobile apps. */
import type { GameRules, LineupPick, MatchStatus, Permission, Position, Role, ScoringRule } from '@kiwanja/core';

export type { Permission, Position, Role };

export interface ClubRef {
  id?: string;
  name?: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
}
export interface Club extends ClubRef {
  id: string;
  name: string;
  city?: string | null;
  stadium?: string | null;
  origin: string;
  _count?: { players: number };
}
export interface Gameweek {
  id: string;
  number: number;
  name: string;
  deadlineAt: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'LOCKED';
  isCurrent: boolean;
  averagePoints?: number;
  highestPoints?: number;
  _count?: { fixtures: number };
}
export interface PlayerStats {
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
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  price: number;
  clubId: string;
  shirtNumber: number | null;
  status: string;
  statusNote?: string | null;
  origin: string;
  club: Club;
  stats?: PlayerStats;
}
export interface Fixture {
  id: string;
  kickoffAt: string;
  status: string;
  homeScore: number;
  awayScore: number;
  homeClub: Club;
  awayClub: Club;
  homeClubId: string;
  awayClubId: string;
  venue?: string | null;
  origin: string;
  gameweek?: { id: string; number: number; name?: string; status?: string } | null;
}
export interface EventTypeMeta {
  code: string;
  label: string;
  category: string;
  needsPlayer: boolean;
  requiresVerification: boolean;
  enabled: boolean;
  extended: boolean;
  primary?: boolean;
  playerLabel?: string;
  secondaryLabel?: string;
  secondaryRequired?: boolean;
  secondaryIsOpponent?: boolean;
  description: string;
}
export interface Meta {
  season: { id: string; name: string; competition: string };
  rules: GameRules;
  scoringRules: ScoringRule[];
  currentGameweek: Gameweek | null;
  nextGameweek: Gameweek | null;
  eventTypes: EventTypeMeta[];
  dataSources: { id: string; name: string; kind: string; attribution: string | null }[];
}

export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  avatarColor: string;
  avatarUrl: string | null;
  favouriteClubId: string | null;
  notifyGoals: boolean;
  notifyDeadlines: boolean;
  canAccessOps: boolean;
  createdAt: string;
}
export interface AuthResponse {
  token: string;
  user: Me;
}

// ---------------------------------------------------------------------------------------
// Fantasy team
export interface SquadEntry {
  id: string;
  playerId: string;
  slot: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  purchasePrice: number;
  nextOpponent: string | null;
  player: Player;
}
export interface PointsLine {
  code: string;
  label: string;
  value: number;
  points: number;
}
export interface LivePick {
  playerId: string;
  slot: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  position: Position;
  player: Player;
  provisionalPoints: number;
  confirmedPoints: number;
  minutes: number;
  multiplier: number;
  counted: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  teamPoints: number;
  breakdown: { fixtureId: string; provisional: PointsLine[]; confirmed: PointsLine[]; fixtureStatus: string }[];
}
export interface TeamGameweekView {
  score: { provisional: number; confirmed: number; transferCost: number; transfersMade: number; net: number } | null;
  autoSubs: { outId: string; inId: string }[];
  multiplierTo: string | null;
  picks: LivePick[];
}
export interface TransfersInfo {
  freeTransfers: number;
  unlimited: boolean;
  hitCost: number;
  wildcardsLeft: number;
  wildcardActive: boolean;
}
export interface MyTeamResponse {
  team: { id: string; name: string; bank: number; totalPoints: number; confirmedTotal: number; freeTransfers: number } | null;
  rank: number;
  squad: SquadEntry[];
  squadValue: number;
  currentGameweek: { id: string; number: number; name: string; status: string } | null;
  nextGameweek: { id: string; number: number; name: string; deadlineAt: string } | null;
  live: TeamGameweekView | null;
  transfersInfo: TransfersInfo;
}
export interface TeamViewResponse {
  team: { name: string; totalPoints: number; user: { displayName: string; avatarColor: string; avatarUrl: string | null } };
  rank: number;
  gameweek: { number: number; name: string } | null;
  view: TeamGameweekView | null;
}
export interface TransferPreview {
  gameweek: number;
  count: number;
  cost: number;
  freeUsed: number;
  freeTransfers: number;
  bankAfter: number;
  unlimited: boolean;
  wildcard: boolean;
  issues: { code: string; message: string }[];
}
export interface TransferHistoryItem {
  id: string;
  createdAt: string;
  cost: number;
  isWildcard: boolean;
  gameweek: { number: number };
  playerIn: Player;
  playerOut: Player;
  priceIn: number;
  priceOut: number;
}
export type LineupDraft = LineupPick & { player: Player; nextOpponent: string | null };

// ---------------------------------------------------------------------------------------
// Players
export interface PlayerResponse {
  player: Player & { nationality: string | null; source: { name: string; kind: string } | null; priceChanges: { id: string; oldPrice: number; newPrice: number; reason: string; createdAt: string }[] };
  stats: PlayerStats;
  history: {
    fixtureId: string;
    provisionalPoints: number;
    confirmedPoints: number;
    minutes: number;
    fixture: Fixture & { gameweek: { number: number } | null };
    stat: { goals: number; assists: number; yellowCards: number; redCards: number; cleanSheet: number; saves: number } | null;
  }[];
  upcoming: (Fixture & { gameweek: { number: number } | null })[];
}
export interface PlayersResponse {
  total: number;
  players: Player[];
}
export interface LeadersResponse {
  points: (Player & { stats: PlayerStats })[];
  [category: string]: (Player & { stats: PlayerStats })[];
}

// ---------------------------------------------------------------------------------------
// Leagues and cups
export interface StandingsRow {
  rank: number;
  teamId: string;
  teamName: string;
  manager: { displayName: string; avatarColor: string; avatarUrl: string | null };
  totalPoints: number;
  confirmedTotal: number;
  gameweekPoints: number;
  gameweekConfirmed: number;
}
export interface Standings {
  gameweek: { id: string; number: number; status: string } | null;
  total: number;
  rows: StandingsRow[];
}
export interface League {
  id: string;
  name: string;
  type: 'CLASSIC' | 'H2H';
  visibility: 'PUBLIC' | 'PRIVATE';
  code: string;
  isSystem: boolean;
  startGameweek: number;
  myRank?: number | null;
  _count: { members: number };
  owner?: { displayName: string } | null;
}
export interface H2HData {
  teams: Record<string, { id: string; name: string; user: { displayName: string; avatarColor: string; avatarUrl: string | null } }>;
  matches: { id: string; gameweekNumber: number; teamAId: string | null; teamBId: string | null; scoreA: number; scoreB: number; finished: boolean; live: boolean }[];
  table: { teamId: string; played: number; won: number; drawn: number; lost: number; pointsFor: number; leaguePoints: number }[];
}
export interface LeagueResponse {
  league: League;
  standings?: Standings;
  h2h?: H2HData;
}
export interface CupSummary {
  id: string;
  name: string;
  status: string;
  startGameweek: number;
  league: { name: string } | null;
}
export interface CupResponse {
  cup: { name: string; status: string; method: string; startGameweek: number; winnerTeamId: string | null; league: { name: string } | null };
  teams: Record<string, { name: string; user: { displayName: string } }>;
  fixtures: {
    id: string;
    round: number;
    roundName: string;
    gameweekNumber: number;
    teamAId: string | null;
    teamBId: string | null;
    seedA: number | null;
    seedB: number | null;
    liveA: number | null;
    liveB: number | null;
    winnerId: string | null;
    gameweekStatus: string;
  }[];
}
export interface MyLeaguesResponse {
  leagues: League[];
  cups: { id: string; name: string; status: string }[];
}

// ---------------------------------------------------------------------------------------
// Notifications
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
export interface NotificationsResponse {
  unread: number;
  items: NotificationItem[];
}

// ---------------------------------------------------------------------------------------
// Match centre
export interface MatchPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  shirtNumber: number | null;
  clubId: string;
}
export interface MatchEventRow {
  id: string;
  clientEventId: string;
  sequence: number;
  code: string;
  side: 'HOME' | 'AWAY' | null;
  minute: number;
  status: string;
  origin: string;
  version: number;
  playerId: string | null;
  secondaryPlayerId: string | null;
  player: MatchPlayer | null;
  secondaryPlayer: MatchPlayer | null;
  recordedBy?: { id: string; displayName: string };
  recordedAt: string;
  clientRecordedAt: string;
  details: Record<string, unknown> | null;
  verifications: { decision: string; createdAt: string; note?: string | null; user?: { id: string; displayName: string } | null }[];
  _count?: { corrections: number };
}
export interface SquadRow {
  id: string;
  playerId: string;
  side: 'HOME' | 'AWAY';
  isStarter: boolean;
  shirtNumber: number | null;
  position: Position;
  player: MatchPlayer;
}
export interface MatchStateResponse {
  fixture: {
    id: string;
    status: MatchStatus;
    homeScore: number;
    awayScore: number;
    kickoffAt: string;
    venue: string | null;
    origin: string;
    periodStartedAt: string | null;
    clockAdjustSec: number;
    homeClubId: string;
    awayClubId: string;
    homeClub: Club;
    awayClub: Club;
    gameweek: { id: string; number: number; name: string; status: string } | null;
    source: { id: string; name: string; kind: string } | null;
  };
  minute: number;
  serverTime: string;
  squad: SquadRow[];
  events: MatchEventRow[];
  assignments?: { userId: string; role: string; user: { id: string; displayName: string; role: string } }[];
  teamStats: { provisional: Record<string, Record<string, number>>; confirmed: Record<string, Record<string, number>> };
  points: {
    playerId: string;
    player: MatchPlayer;
    minutes: number;
    provisionalPoints: number;
    confirmedPoints: number;
    provisionalBreakdown: PointsLine[];
    confirmedBreakdown: PointsLine[];
  }[];
}
