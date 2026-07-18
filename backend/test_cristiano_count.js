const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('SET LOCAL pg_trgm.word_similarity_threshold = 0.5;');
  const normalizedSearch = 'cristiano';
  const res = await prisma.$queryRaw`
    SELECT count(p.id) as count
    FROM "Player" p
    WHERE 
      lower(unaccent_immutable(p.name)) %> lower(unaccent(${normalizedSearch})) OR
      lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> lower(unaccent(${normalizedSearch}))
  `;
  console.log("trigram:", res);

  const res2 = await prisma.player.count({
    where: {
      name: { contains: normalizedSearch, mode: 'insensitive' }
    }
  });
  console.log("contains:", res2);
}

main().finally(() => prisma.$disconnect());
