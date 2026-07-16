import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const clubClauses = await prisma.questionFilterClause.findMany({ where: { filterType: 'CLUB' } });
  console.log("Club clauses:", JSON.stringify(clubClauses, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
