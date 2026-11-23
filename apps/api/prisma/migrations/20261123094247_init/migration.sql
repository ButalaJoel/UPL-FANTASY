-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'COMPETITION_ADMIN', 'MATCH_SUPERVISOR', 'MATCH_ANALYST', 'FANTASY_USER');

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GK', 'DEF', 'MID', 'FWD');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('HOME', 'AWAY');

-- CreateEnum
CREATE TYPE "RecordOrigin" AS ENUM ('SAMPLE', 'MANUAL', 'IMPORTED', 'DEVICE', 'VIDEO');

-- CreateEnum
CREATE TYPE "DataSourceKind" AS ENUM ('MANUAL_LIVE', 'MANUAL_HISTORICAL', 'IMPORT', 'SAMPLE', 'TRACKING_DEVICE', 'VIDEO_ANALYTICS', 'PARTNER_FEED');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('AVAILABLE', 'DOUBTFUL', 'INJURED', 'SUSPENDED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'FULL_TIME', 'COMPLETED', 'PUBLISHED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PENDING', 'VERIFIED', 'DISPUTED', 'REJECTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('AUTO', 'CONFIRM', 'DISPUTE', 'REJECT', 'RESOLVE_VERIFY', 'RESOLVE_REJECT', 'RESOLVE_VOID');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('PRIMARY', 'VERIFIER', 'SUPERVISOR');

-- CreateEnum
CREATE TYPE "StatBasis" AS ENUM ('PROVISIONAL', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "GameweekStatus" AS ENUM ('UPCOMING', 'LIVE', 'FINISHED', 'LOCKED');

-- CreateEnum
CREATE TYPE "LeagueType" AS ENUM ('CLASSIC', 'H2H');

-- CreateEnum
CREATE TYPE "LeagueVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CupMethod" AS ENUM ('RANDOM', 'SEEDED');

-- CreateEnum
CREATE TYPE "CupStatus" AS ENUM ('DRAWN', 'RUNNING', 'FINISHED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FANTASY_USER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "avatarColor" TEXT NOT NULL DEFAULT '#1F7A4D',
    "avatarUrl" TEXT,
    "favouriteClubId" TEXT,
    "notifyGoals" BOOLEAN NOT NULL DEFAULT true,
    "notifyDeadlines" BOOLEAN NOT NULL DEFAULT true,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_queue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "deviceId" TEXT,
    "received" INTEGER NOT NULL,
    "created" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "conflicts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DataSourceKind" NOT NULL,
    "url" TEXT,
    "attribution" TEXT,
    "licence" TEXT,
    "notes" TEXT,
    "apiKeyHash" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Uganda',
    "origin" "RecordOrigin" NOT NULL DEFAULT 'SAMPLE',

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "city" TEXT,
    "stadium" TEXT,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "origin" "RecordOrigin" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "shirtNumber" INTEGER,
    "price" INTEGER NOT NULL,
    "status" "PlayerStatus" NOT NULL DEFAULT 'AVAILABLE',
    "statusNote" TEXT,
    "nationality" TEXT,
    "origin" "RecordOrigin" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_price_changes" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameweekId" TEXT,
    "oldPrice" INTEGER NOT NULL,
    "newPrice" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gameweeks" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "status" "GameweekStatus" NOT NULL DEFAULT 'UPCOMING',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),

    CONSTRAINT "gameweeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "gameweekId" TEXT,
    "homeClubId" TEXT NOT NULL,
    "awayClubId" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "periodStartedAt" TIMESTAMP(3),
    "clockAdjustSec" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "origin" "RecordOrigin" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_squads" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "isStarter" BOOLEAN NOT NULL,
    "shirtNumber" INTEGER,
    "position" "Position" NOT NULL,

    CONSTRAINT "match_squads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyst_assignments" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analyst_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_types" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "needsPlayer" BOOLEAN NOT NULL,
    "requiresVerification" BOOLEAN NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "extended" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "event_types_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "clientEventId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "side" "Side",
    "playerId" TEXT,
    "secondaryPlayerId" TEXT,
    "minute" INTEGER NOT NULL,
    "details" JSONB,
    "status" "EventStatus" NOT NULL DEFAULT 'PENDING',
    "origin" "RecordOrigin" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "recordedById" TEXT NOT NULL,
    "clientRecordedAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "verifiedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_verifications" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT,
    "decision" "VerificationDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_corrections" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "versionFrom" INTEGER NOT NULL,
    "versionTo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_metrics" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "sourceId" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_match_statistics" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "basis" "StatBasis" NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "started" INTEGER NOT NULL DEFAULT 0,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "ownGoals" INTEGER NOT NULL DEFAULT 0,
    "goalsConceded" INTEGER NOT NULL DEFAULT 0,
    "cleanSheet" INTEGER NOT NULL DEFAULT 0,
    "yellowCards" INTEGER NOT NULL DEFAULT 0,
    "redCards" INTEGER NOT NULL DEFAULT 0,
    "penaltiesWon" INTEGER NOT NULL DEFAULT 0,
    "penaltiesMissed" INTEGER NOT NULL DEFAULT 0,
    "penaltiesSaved" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "shotsOnTarget" INTEGER NOT NULL DEFAULT 0,
    "shotsOffTarget" INTEGER NOT NULL DEFAULT 0,
    "shotsBlocked" INTEGER NOT NULL DEFAULT 0,
    "keyPasses" INTEGER NOT NULL DEFAULT 0,
    "bigChancesCreated" INTEGER NOT NULL DEFAULT 0,
    "passesCompleted" INTEGER NOT NULL DEFAULT 0,
    "passesFailed" INTEGER NOT NULL DEFAULT 0,
    "tackles" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "clearances" INTEGER NOT NULL DEFAULT 0,
    "fouls" INTEGER NOT NULL DEFAULT 0,
    "offsides" INTEGER NOT NULL DEFAULT 0,
    "corners" INTEGER NOT NULL DEFAULT 0,
    "manOfTheMatch" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_match_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_match_statistics" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "basis" "StatBasis" NOT NULL,
    "stats" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_match_statistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_points" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameweekId" TEXT,
    "provisionalPoints" INTEGER NOT NULL DEFAULT 0,
    "provisionalBreakdown" JSONB NOT NULL,
    "confirmedPoints" INTEGER NOT NULL DEFAULT 0,
    "confirmedBreakdown" JSONB NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fantasy_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_rules" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "statKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "unit" INTEGER NOT NULL DEFAULT 1,
    "min" INTEGER,
    "max" INTEGER,
    "minMinutes" INTEGER NOT NULL DEFAULT 0,
    "pointsGK" INTEGER NOT NULL,
    "pointsDEF" INTEGER NOT NULL,
    "pointsMID" INTEGER NOT NULL,
    "pointsFWD" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "experimental" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scoring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_teams" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank" INTEGER NOT NULL,
    "freeTransfers" INTEGER NOT NULL DEFAULT 1,
    "wildcardsUsed" INTEGER NOT NULL DEFAULT 0,
    "wildcardGameweek" INTEGER,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "confirmedTotal" INTEGER NOT NULL DEFAULT 0,
    "startGameweek" INTEGER NOT NULL DEFAULT 1,
    "origin" "RecordOrigin" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fantasy_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_squads" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "purchasePrice" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "isViceCaptain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fantasy_squads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_gameweek_picks" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "slot" INTEGER NOT NULL,
    "isCaptain" BOOLEAN NOT NULL,
    "isViceCaptain" BOOLEAN NOT NULL,

    CONSTRAINT "fantasy_gameweek_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_transfers" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "playerOutId" TEXT NOT NULL,
    "playerInId" TEXT NOT NULL,
    "priceOut" INTEGER NOT NULL,
    "priceIn" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "isWildcard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fantasy_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_gameweek_scores" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "provisionalPoints" INTEGER NOT NULL DEFAULT 0,
    "confirmedPoints" INTEGER NOT NULL DEFAULT 0,
    "transferCost" INTEGER NOT NULL DEFAULT 0,
    "transfersMade" INTEGER NOT NULL DEFAULT 0,
    "breakdown" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fantasy_gameweek_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_leagues" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LeagueType" NOT NULL,
    "visibility" "LeagueVisibility" NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "startGameweek" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fantasy_leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "league_members" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "league_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "head_to_head_matches" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "gameweekNumber" INTEGER NOT NULL,
    "gameweekId" TEXT,
    "teamAId" TEXT,
    "teamBId" TEXT,

    CONSTRAINT "head_to_head_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fantasy_cups" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leagueId" TEXT,
    "startGameweek" INTEGER NOT NULL,
    "maxEntrants" INTEGER NOT NULL,
    "method" "CupMethod" NOT NULL,
    "seed" INTEGER NOT NULL,
    "status" "CupStatus" NOT NULL DEFAULT 'DRAWN',
    "winnerTeamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fantasy_cups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cup_fixtures" (
    "id" TEXT NOT NULL,
    "cupId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "roundName" TEXT NOT NULL,
    "gameweekNumber" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "teamAId" TEXT,
    "teamBId" TEXT,
    "seedA" INTEGER,
    "seedB" INTEGER,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "winnerId" TEXT,

    CONSTRAINT "cup_fixtures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "sync_queue_fixtureId_idx" ON "sync_queue"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_name_key" ON "data_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_competitionId_name_key" ON "seasons"("competitionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_name_key" ON "clubs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "clubs_shortName_key" ON "clubs"("shortName");

-- CreateIndex
CREATE INDEX "players_clubId_idx" ON "players"("clubId");

-- CreateIndex
CREATE INDEX "players_position_idx" ON "players"("position");

-- CreateIndex
CREATE INDEX "player_price_changes_playerId_idx" ON "player_price_changes"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "gameweeks_seasonId_number_key" ON "gameweeks"("seasonId", "number");

-- CreateIndex
CREATE INDEX "fixtures_gameweekId_idx" ON "fixtures"("gameweekId");

-- CreateIndex
CREATE INDEX "fixtures_status_idx" ON "fixtures"("status");

-- CreateIndex
CREATE INDEX "fixtures_kickoffAt_idx" ON "fixtures"("kickoffAt");

-- CreateIndex
CREATE INDEX "match_squads_fixtureId_side_idx" ON "match_squads"("fixtureId", "side");

-- CreateIndex
CREATE UNIQUE INDEX "match_squads_fixtureId_playerId_key" ON "match_squads"("fixtureId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "analyst_assignments_fixtureId_userId_key" ON "analyst_assignments"("fixtureId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_clientEventId_key" ON "match_events"("clientEventId");

-- CreateIndex
CREATE INDEX "match_events_fixtureId_status_idx" ON "match_events"("fixtureId", "status");

-- CreateIndex
CREATE INDEX "match_events_playerId_idx" ON "match_events"("playerId");

-- CreateIndex
CREATE INDEX "event_verifications_eventId_idx" ON "event_verifications"("eventId");

-- CreateIndex
CREATE INDEX "event_corrections_eventId_idx" ON "event_corrections"("eventId");

-- CreateIndex
CREATE INDEX "player_metrics_fixtureId_playerId_idx" ON "player_metrics"("fixtureId", "playerId");

-- CreateIndex
CREATE INDEX "player_match_statistics_playerId_basis_idx" ON "player_match_statistics"("playerId", "basis");

-- CreateIndex
CREATE UNIQUE INDEX "player_match_statistics_fixtureId_playerId_basis_key" ON "player_match_statistics"("fixtureId", "playerId", "basis");

-- CreateIndex
CREATE UNIQUE INDEX "team_match_statistics_fixtureId_side_basis_key" ON "team_match_statistics"("fixtureId", "side", "basis");

-- CreateIndex
CREATE INDEX "fantasy_points_gameweekId_playerId_idx" ON "fantasy_points"("gameweekId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_points_fixtureId_playerId_key" ON "fantasy_points"("fixtureId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_rules_code_key" ON "scoring_rules"("code");

-- CreateIndex
CREATE INDEX "fantasy_teams_totalPoints_idx" ON "fantasy_teams"("totalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_teams_userId_seasonId_key" ON "fantasy_teams"("userId", "seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_squads_teamId_playerId_key" ON "fantasy_squads"("teamId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_squads_teamId_slot_key" ON "fantasy_squads"("teamId", "slot");

-- CreateIndex
CREATE INDEX "fantasy_gameweek_picks_gameweekId_idx" ON "fantasy_gameweek_picks"("gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_gameweek_picks_teamId_gameweekId_playerId_key" ON "fantasy_gameweek_picks"("teamId", "gameweekId", "playerId");

-- CreateIndex
CREATE INDEX "fantasy_transfers_teamId_idx" ON "fantasy_transfers"("teamId");

-- CreateIndex
CREATE INDEX "fantasy_transfers_gameweekId_idx" ON "fantasy_transfers"("gameweekId");

-- CreateIndex
CREATE INDEX "fantasy_gameweek_scores_gameweekId_provisionalPoints_idx" ON "fantasy_gameweek_scores"("gameweekId", "provisionalPoints");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_gameweek_scores_teamId_gameweekId_key" ON "fantasy_gameweek_scores"("teamId", "gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "fantasy_leagues_code_key" ON "fantasy_leagues"("code");

-- CreateIndex
CREATE UNIQUE INDEX "league_members_leagueId_teamId_key" ON "league_members"("leagueId", "teamId");

-- CreateIndex
CREATE INDEX "head_to_head_matches_leagueId_gameweekNumber_idx" ON "head_to_head_matches"("leagueId", "gameweekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cup_fixtures_cupId_round_slot_key" ON "cup_fixtures"("cupId", "round", "slot");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_favouriteClubId_fkey" FOREIGN KEY ("favouriteClubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_price_changes" ADD CONSTRAINT "player_price_changes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gameweeks" ADD CONSTRAINT "gameweeks_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "gameweeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_homeClubId_fkey" FOREIGN KEY ("homeClubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_awayClubId_fkey" FOREIGN KEY ("awayClubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixtures" ADD CONSTRAINT "fixtures_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_squads" ADD CONSTRAINT "match_squads_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_squads" ADD CONSTRAINT "match_squads_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_assignments" ADD CONSTRAINT "analyst_assignments_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analyst_assignments" ADD CONSTRAINT "analyst_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_code_fkey" FOREIGN KEY ("code") REFERENCES "event_types"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_secondaryPlayerId_fkey" FOREIGN KEY ("secondaryPlayerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_verifications" ADD CONSTRAINT "event_verifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "match_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_verifications" ADD CONSTRAINT "event_verifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_corrections" ADD CONSTRAINT "event_corrections_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "match_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_corrections" ADD CONSTRAINT "event_corrections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_metrics" ADD CONSTRAINT "player_metrics_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_metrics" ADD CONSTRAINT "player_metrics_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_metrics" ADD CONSTRAINT "player_metrics_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_statistics" ADD CONSTRAINT "player_match_statistics_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_match_statistics" ADD CONSTRAINT "player_match_statistics_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_match_statistics" ADD CONSTRAINT "team_match_statistics_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_points" ADD CONSTRAINT "fantasy_points_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_points" ADD CONSTRAINT "fantasy_points_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_points" ADD CONSTRAINT "fantasy_points_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "gameweeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_teams" ADD CONSTRAINT "fantasy_teams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_teams" ADD CONSTRAINT "fantasy_teams_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_squads" ADD CONSTRAINT "fantasy_squads_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fantasy_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_squads" ADD CONSTRAINT "fantasy_squads_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_gameweek_picks" ADD CONSTRAINT "fantasy_gameweek_picks_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fantasy_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_gameweek_picks" ADD CONSTRAINT "fantasy_gameweek_picks_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_gameweek_picks" ADD CONSTRAINT "fantasy_gameweek_picks_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fantasy_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "gameweeks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_playerOutId_fkey" FOREIGN KEY ("playerOutId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_transfers" ADD CONSTRAINT "fantasy_transfers_playerInId_fkey" FOREIGN KEY ("playerInId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_gameweek_scores" ADD CONSTRAINT "fantasy_gameweek_scores_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fantasy_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_gameweek_scores" ADD CONSTRAINT "fantasy_gameweek_scores_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "gameweeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_leagues" ADD CONSTRAINT "fantasy_leagues_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_leagues" ADD CONSTRAINT "fantasy_leagues_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "fantasy_leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "league_members" ADD CONSTRAINT "league_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "fantasy_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "head_to_head_matches" ADD CONSTRAINT "head_to_head_matches_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "fantasy_leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "head_to_head_matches" ADD CONSTRAINT "head_to_head_matches_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "gameweeks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_cups" ADD CONSTRAINT "fantasy_cups_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fantasy_cups" ADD CONSTRAINT "fantasy_cups_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "fantasy_leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cup_fixtures" ADD CONSTRAINT "cup_fixtures_cupId_fkey" FOREIGN KEY ("cupId") REFERENCES "fantasy_cups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
