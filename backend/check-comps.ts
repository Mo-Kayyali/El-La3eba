import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "Competition" WHERE "type"::text IN ('CONTINENTAL_CLUB', 'INTERNATIONAL_NATIONAL_TEAM')`
  );
  console.log('Competitions with old types:', count.length);
  const allComps = await prisma.competition.findMany();
  console.log('Total competitions:', allComps.length);
}
main().finally(() => prisma.$disconnect());
