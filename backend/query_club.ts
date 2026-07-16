import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.club.findUnique({ where: { id: '3dd4c3d8-8880-473f-aedd-146ba6bb8b84' } });
  console.log("Club with that ID:", c?.name);
  
  const rm = await prisma.club.findFirst({ where: { name: 'Real Madrid' }, include: { currentCompetition: true } });
  console.log("Real Madrid ID:", rm?.id);
  console.log("Real Madrid current competition:", rm?.currentCompetition?.id, rm?.currentCompetition?.name);
  console.log("Real Madrid denormalized competitions:", rm?.competitions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
