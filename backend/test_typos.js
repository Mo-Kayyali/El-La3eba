const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRaw`
    SELECT 
      word_similarity('mohamed slah', 'mohamed salah') as sim1,
      levenshtein('mohamed slah', 'mohamed salah') as lev1,
      word_similarity('crstiano', 'cristiano') as sim2,
      levenshtein('crstiano', 'cristiano') as lev2
  `;
  console.log(res);
}

main().finally(() => prisma.$disconnect());
