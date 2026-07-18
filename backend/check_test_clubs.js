const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== TEST CLUBS INVESTIGATION ===\n');

  const targetNames = ['Real Madrid', 'Barcelona', 'test club'];

  for (const tName of targetNames) {
    const clubs = await prisma.club.findMany({
      where: {
        name: { contains: tName, mode: 'insensitive' }
      },
      include: {
        currentPlayers: true,
        playerClubs: true
      }
    });

    console.log(`\nResults for "${tName}":`);
    if (clubs.length === 0) {
      console.log('  No clubs found matching this name.');
      continue;
    }

    for (const c of clubs) {
      console.log(`  - Club ID: ${c.id}`);
      console.log(`    Exact Name: ${c.name}`);
      console.log(`    CountryCode: ${c.countryCode || 'null'}`);
      console.log(`    CurrentCompetitionId: ${c.currentCompetitionId || 'null'}`);
      console.log(`    LogoUrl: ${c.logoUrl ? c.logoUrl.substring(0, 30) + '...' : 'null'}`);
      console.log(`    Current Players Count (currentClubId): ${c.currentPlayers.length}`);
      console.log(`    PlayerClub History Rows Linked: ${c.playerClubs.length}`);
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
