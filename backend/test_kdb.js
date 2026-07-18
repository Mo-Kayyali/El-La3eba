const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.$queryRaw`
    SELECT 
      word_similarity('kavin de bruyne', 'kevin de bruyne') as sim1,
      levenshtein('kavin de bruyne', 'kevin de bruyne') as lev1
  `;
  console.log(res);
}

main().finally(() => prisma.$disconnect());
