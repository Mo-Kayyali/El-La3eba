const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('SET LOCAL pg_trgm.word_similarity_threshold = 0.5;');
  const normalizedSearch = 'cristiano';
  const res = await prisma.$queryRaw`
    SELECT p.name, array_to_string_immutable(p.aliases, ' ') as aliases,
      word_similarity(lower(unaccent(${normalizedSearch})), lower(unaccent_immutable(p.name))) as sim1
    FROM "Player" p
    WHERE 
      lower(unaccent_immutable(p.name)) %> lower(unaccent(${normalizedSearch})) OR
      lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> lower(unaccent(${normalizedSearch}))
  `;
  console.log(res.length, "players found");
}

main().finally(() => prisma.$disconnect());
