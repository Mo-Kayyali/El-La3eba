const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const queries = ['cristiano ronaldo', 'cristiano', 'lionel messi', 'mohamed salah', 'mohamed el shenawy', 'maradona', 'ronaldinho', 'de bruyne'];
const thresholds = [0.3, 0.4, 0.5, 0.6, 0.7];

async function main() {
  for (const q of queries) {
    console.log(`\n--- Query: "${q}" ---`);
    for (const t of thresholds) {
      await prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = ${t};`);
      const res = await prisma.$queryRaw`
        SELECT count(p.id) as count
        FROM "Player" p
        WHERE 
          lower(unaccent_immutable(p.name)) %> lower(unaccent(${q})) OR
          lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> lower(unaccent(${q}))
      `;
      console.log(`Threshold ${t}: ${res[0].count} players pre-filtered`);
    }
  }
}

main().finally(() => prisma.$disconnect());
