BEGIN;
DROP INDEX IF EXISTS "Player_name_gin_trgm_idx";
DROP INDEX IF EXISTS "Player_aliases_gin_trgm_idx";

CREATE OR REPLACE FUNCTION unaccent_immutable(TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
RETURNS NULL ON NULL INPUT
AS $$ SELECT unaccent($1) $$;

CREATE INDEX "Player_name_gin_trgm_idx" ON "Player" USING GIN (lower(unaccent_immutable("name")) gin_trgm_ops);
CREATE INDEX "Player_aliases_gin_trgm_idx" ON "Player" USING GIN (lower(unaccent_immutable(array_to_string_immutable("aliases", ' '))) gin_trgm_ops);
COMMIT;
