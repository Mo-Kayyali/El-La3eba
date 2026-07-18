const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRaw`
    SELECT 
      word_similarity('ronaldo', 'ronaldinho') as sim1,
      levenshtein('ronaldo', 'ronaldinho') as lev1,
      word_similarity('messi', 'mendy') as sim2,
      levenshtein('messi', 'mendy') as lev2,
      word_similarity('salah', 'saha') as sim3,
      levenshtein('salah', 'saha') as lev3
  `;
  console.log(res);
}

main().finally(() => prisma.$disconnect());
