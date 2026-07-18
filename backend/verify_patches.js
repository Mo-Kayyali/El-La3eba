const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('--- Verifying Legends ---');
  const l1 = await prisma.player.findFirst({ where: { name: 'Hossam Hassan Kamel' } });
  console.log('Hossam Hassan Kamel:', l1.nationality, l1.isRetired);

  const l2 = await prisma.player.findFirst({ where: { name: 'Mahmoud El Khatib' } });
  console.log('Mahmoud El Khatib:', l2.nationality, l2.isRetired);

  console.log('\n--- Verifying Active Pyramids Player ---');
  const a1 = await prisma.player.findFirst({
    where: { name: 'Ahmed El Shenawy' },
    include: { playerClubs: { include: { club: true } } }
  });
  console.log('Ahmed El Shenawy:', 'CurrentClubId:', !!a1.currentClubId);
  const currentStint = a1.playerClubs.find(c => c.isCurrent);
  if (currentStint) console.log('Current Stint:', currentStint.club.name);

  console.log('\n--- Verifying Name Split ---');
  const m1 = await prisma.player.findFirst({ where: { firstName: 'Mahmoud', lastName: 'El Khatib' } });
  if (m1) console.log('Mahmoud El Khatib correctly split:', m1.firstName, '|', m1.lastName);

  await prisma.$disconnect();
}

run().catch(console.error);
