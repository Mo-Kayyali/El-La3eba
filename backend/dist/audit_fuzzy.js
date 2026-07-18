"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const guessName = "ronaldo";
    const normalizedGuess = guessName;
    const allowedTypos = 1;
    await prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.15;`);
    const res = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    WITH guess AS (
      SELECT lower(unaccent($1)) AS val
    ),
    player_metrics AS (
      SELECT 
        p.*,
        c.name as "currentClubName",
        c.competitions as "currentClubCompetitions",
        g.val,
        (
          SELECT min(levenshtein(lower(unaccent(alias)), g.val))
          FROM unnest(array_append(p.aliases, p.name)) as alias
          WHERE abs(char_length(g.val) - char_length(alias)) <= 3
        ) as best_dist,
        GREATEST(
          word_similarity(g.val, lower(unaccent_immutable(p.name))),
          word_similarity(g.val, lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))))
        ) as w_sim
      FROM "Player" p
      LEFT JOIN "Club" c ON p."currentClubId" = c.id
      CROSS JOIN guess g
      WHERE
        (
          lower(unaccent_immutable(p.name)) %> g.val OR
          lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> g.val
        )
    )
    SELECT *
    FROM player_metrics
    WHERE 
      best_dist <= $2
    ORDER BY 
      w_sim DESC,
      best_dist ASC
    LIMIT 5;
  `, normalizedGuess, allowedTypos);
    console.log(JSON.stringify(res, null, 2));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=audit_fuzzy.js.map