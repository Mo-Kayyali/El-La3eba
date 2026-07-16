import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const totalClubs = await prisma.club.count();
  const clubsWithCompId = await prisma.club.count({ where: { currentCompetitionId: { not: null } } });
  
  console.log(`Total Club rows in database: ${totalClubs}`);
  console.log(`Clubs with currentCompetitionId set: ${clubsWithCompId}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
