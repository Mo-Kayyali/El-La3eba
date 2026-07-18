const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRaw`
    SELECT 
      word_similarity('mhamed salah', 'mohamed salah') as sim1,
      levenshtein('mhamed salah', 'mohamed salah') as lev1
  `;
  console.log(res);
}

main().finally(() => prisma.$disconnect());
