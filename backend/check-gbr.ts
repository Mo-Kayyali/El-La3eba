import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const clubs = await prisma.club.count({ where: { countryCode: 'GBR' } });
  const players = await prisma.player.count({ where: { nationality: 'GBR' } });
  console.log('Clubs with GBR:', clubs);
  console.log('Players with GBR:', players);
}
main().finally(() => prisma.$disconnect());
