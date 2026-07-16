-- ============================================================
-- Migration: structured_schema_v2
-- Replaces FootballPlayer with a fully-structured schema:
--   Country, Competition, Club, Player, PlayerClub,
--   Question, QuestionAnswer, AnswerSuggestion
-- Adds Role enum + role field to User.
-- Drops FootballPlayer table and all its data entirely.
-- ============================================================

-- Ensure extensions exist (idempotent; also done in prior migrations)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');
CREATE TYPE "CompetitionType" AS ENUM ('DOMESTIC_LEAGUE', 'DOMESTIC_CUP', 'CONTINENTAL_CLUB', 'INTERNATIONAL_NATIONAL_TEAM');
CREATE TYPE "Position" AS ENUM ('GK', 'RB', 'CB', 'LB', 'RWB', 'LWB', 'CDM', 'CM', 'CAM', 'RM', 'LM', 'RW', 'LW', 'CF', 'ST');
CREATE TYPE "PreferredFoot" AS ENUM ('LEFT', 'RIGHT', 'BOTH');
CREATE TYPE "GameMode" AS ENUM ('STRIKES', 'TOP_10', 'PHOTO_GUESS', 'LINEUP');
CREATE TYPE "AnswerType" AS ENUM ('FILTER', 'LIST');
CREATE TYPE "FilterType" AS ENUM ('COMPETITION', 'NATIONALITY', 'CLUB', 'POSITION', 'POSITION_CATEGORY');
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ─── AlterTable User ──────────────────────────────────────────────────────────

ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'PLAYER';

-- ─── Drop old FootballPlayer (all data gone — clean slate) ────────────────────

DROP TABLE "FootballPlayer";

-- ─── Country ─────────────────────────────────────────────────────────────────

CREATE TABLE "Country" (
    "id"   TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- ─── Competition ──────────────────────────────────────────────────────────────

CREATE TABLE "Competition" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "type"        "CompetitionType" NOT NULL,
    "countryCode" TEXT,
    "tier"        INTEGER,
    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- ─── Club ─────────────────────────────────────────────────────────────────────

CREATE TABLE "Club" (
    "id"                   TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "aliases"              TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countryCode"          TEXT NOT NULL,
    "currentCompetitionId" TEXT,
    "competitions"         TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoUrl"              TEXT,
    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- ─── Player ───────────────────────────────────────────────────────────────────

CREATE TABLE "Player" (
    "id"              TEXT NOT NULL,
    "firstName"       TEXT NOT NULL,
    "lastName"        TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "aliases"         TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nationality"     TEXT NOT NULL,
    "dateOfBirth"     TIMESTAMP(3),
    "heightCm"        INTEGER,
    "preferredFoot"   "PreferredFoot",
    "positions"       "Position"[] DEFAULT ARRAY[]::"Position"[],
    "primaryPosition" "Position",
    "isRetired"       BOOLEAN NOT NULL DEFAULT false,
    "currentClubId"   TEXT,
    "imageUrl"        TEXT,
    "clubs"           TEXT[] DEFAULT ARRAY[]::TEXT[],
    "competitions"    TEXT[] DEFAULT ARRAY[]::TEXT[],
    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- ─── PlayerClub ───────────────────────────────────────────────────────────────

CREATE TABLE "PlayerClub" (
    "id"        TEXT NOT NULL,
    "playerId"  TEXT NOT NULL,
    "clubId"    TEXT NOT NULL,
    "startYear" INTEGER,
    "endYear"   INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PlayerClub_pkey" PRIMARY KEY ("id")
);

-- ─── Question ─────────────────────────────────────────────────────────────────

CREATE TABLE "Question" (
    "id"            TEXT NOT NULL,
    "text"          TEXT NOT NULL,
    "gameMode"      "GameMode" NOT NULL,
    "answerType"    "AnswerType" NOT NULL,
    "filterType"    "FilterType",
    "filterValue"   TEXT,
    "photoPlayerId" TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- ─── QuestionAnswer ───────────────────────────────────────────────────────────

CREATE TABLE "QuestionAnswer" (
    "id"         TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "playerId"   TEXT NOT NULL,
    "rank"       INTEGER,
    "slotLabel"  TEXT,
    CONSTRAINT "QuestionAnswer_pkey" PRIMARY KEY ("id")
);

-- ─── AnswerSuggestion ─────────────────────────────────────────────────────────

CREATE TABLE "AnswerSuggestion" (
    "id"          TEXT NOT NULL,
    "questionId"  TEXT NOT NULL,
    "guessText"   TEXT NOT NULL,
    "suggestedBy" TEXT NOT NULL,
    "status"      "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote"  TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt"  TIMESTAMP(3),
    CONSTRAINT "AnswerSuggestion_pkey" PRIMARY KEY ("id")
);

-- ─── Indexes — GIN array indexes (Prisma-managed) ────────────────────────────

CREATE INDEX "Club_competitions_idx"    ON "Club"   USING GIN ("competitions");
CREATE INDEX "Player_positions_idx"     ON "Player" USING GIN ("positions");
CREATE INDEX "Player_clubs_idx"         ON "Player" USING GIN ("clubs");
CREATE INDEX "Player_competitions_idx"  ON "Player" USING GIN ("competitions");

-- ─── Indexes — GIN + pg_trgm on Player.name and Player.aliases ───────────────
-- Identical strategy to the old FootballPlayer.name / FootballPlayer.aliases
-- indexes from 20260411120000_performance_indexes. These feed the fuzzy-search
-- query in game.service.ts (which will be repointed to "Player" in a follow-up).
--
-- NOTE: array_to_string() is STABLE (not IMMUTABLE) in Postgres 15, so it
-- cannot be used directly in an index expression. We create an IMMUTABLE SQL
-- wrapper function as the standard workaround.

CREATE OR REPLACE FUNCTION array_to_string_immutable(TEXT[], TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$ SELECT array_to_string($1, $2) $$;

CREATE INDEX "Player_name_gin_trgm_idx"    ON "Player" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Player_aliases_gin_trgm_idx" ON "Player" USING GIN (array_to_string_immutable("aliases", ' ') gin_trgm_ops);

-- ─── Indexes — scalar ─────────────────────────────────────────────────────────

CREATE INDEX "PlayerClub_playerId_idx"              ON "PlayerClub"("playerId");
CREATE INDEX "PlayerClub_clubId_idx"                ON "PlayerClub"("clubId");
CREATE INDEX "Question_gameMode_idx"                ON "Question"("gameMode");
CREATE INDEX "Question_answerType_filterType_idx"   ON "Question"("answerType", "filterType");
CREATE INDEX "QuestionAnswer_questionId_idx"        ON "QuestionAnswer"("questionId");
CREATE INDEX "QuestionAnswer_playerId_idx"          ON "QuestionAnswer"("playerId");
CREATE UNIQUE INDEX "QuestionAnswer_questionId_playerId_key" ON "QuestionAnswer"("questionId", "playerId");
CREATE INDEX "AnswerSuggestion_questionId_status_idx" ON "AnswerSuggestion"("questionId", "status");
CREATE INDEX "AnswerSuggestion_suggestedBy_idx"     ON "AnswerSuggestion"("suggestedBy");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

ALTER TABLE "Competition"
    ADD CONSTRAINT "Competition_countryCode_fkey"
    FOREIGN KEY ("countryCode") REFERENCES "Country"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Club"
    ADD CONSTRAINT "Club_countryCode_fkey"
    FOREIGN KEY ("countryCode") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Club"
    ADD CONSTRAINT "Club_currentCompetitionId_fkey"
    FOREIGN KEY ("currentCompetitionId") REFERENCES "Competition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Player"
    ADD CONSTRAINT "Player_currentClubId_fkey"
    FOREIGN KEY ("currentClubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PlayerClub"
    ADD CONSTRAINT "PlayerClub_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PlayerClub"
    ADD CONSTRAINT "PlayerClub_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Question"
    ADD CONSTRAINT "Question_photoPlayerId_fkey"
    FOREIGN KEY ("photoPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "QuestionAnswer"
    ADD CONSTRAINT "QuestionAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "QuestionAnswer"
    ADD CONSTRAINT "QuestionAnswer_playerId_fkey"
    FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnswerSuggestion"
    ADD CONSTRAINT "AnswerSuggestion_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnswerSuggestion"
    ADD CONSTRAINT "AnswerSuggestion_suggestedBy_fkey"
    FOREIGN KEY ("suggestedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
