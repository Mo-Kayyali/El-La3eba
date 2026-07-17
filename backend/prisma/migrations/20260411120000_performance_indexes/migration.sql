-- pg_trgm (also created in a prior migration; idempotent)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- AlterTable
ALTER TABLE "FootballPlayer" ADD COLUMN "aliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- GIN (pg_trgm) for fuzzy matching on canonical name
CREATE INDEX "FootballPlayer_name_gin_trgm_idx" ON "FootballPlayer" USING GIN ("name" gin_trgm_ops);

CREATE OR REPLACE FUNCTION array_to_string_immutable(TEXT[], TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$ SELECT array_to_string($1, $2) $$;

-- GIN (pg_trgm) on flattened alias text (use array_to_string_immutable for TEXT[] → text)
CREATE INDEX "FootballPlayer_aliases_gin_trgm_idx" ON "FootballPlayer" USING GIN (array_to_string_immutable("aliases", ' ') gin_trgm_ops);

-- B-tree for ordered MMR reads (leaderboard / matchmaking)
CREATE INDEX "User_mmr_idx" ON "User" ("mmr");
