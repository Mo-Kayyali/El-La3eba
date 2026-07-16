const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [_, explainResult] = await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.15;`),
    prisma.$queryRawUnsafe(`
      EXPLAIN ANALYZE
      WITH guess AS (
          SELECT lower(unaccent('ronaldo')) AS val
        ),
        player_metrics AS (
          SELECT 
            p.*,
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
          FROM "Player" p, guess g
          WHERE
            (
              lower(unaccent_immutable(p.name)) %> g.val OR
              lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> g.val
            )
        )
        SELECT *
        FROM player_metrics
        WHERE 
          best_dist <= 2
        ORDER BY 
          w_sim DESC,
          best_dist ASC
        LIMIT 1;
    `)
  ]);
  console.log(JSON.stringify(explainResult, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
