const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const names = ['Hossam Hassan Kamel', 'Essam El Hadary', 'Ahmed Hassan'];
  
  for (const name of names) {
    const players = await prisma.player.findMany({
      where: { name: name },
      include: {
        playerClubs: {
          include: { club: true }
        }
      }
    });

    console.log(`\n=== ${name} ===`);
    if (players.length === 0) {
      console.log('Not found.');
      continue;
    }
    for (const p of players) {
      console.log(`Player ID: ${p.id}`);
      console.log(`Total PlayerClub rows: ${p.playerClubs.length}`);
      p.playerClubs.forEach(pc => {
        console.log(`  - ${pc.club.name} (${pc.startYear} - ${pc.endYear})`);
      });
    }
  }

  await prisma.$disconnect();
}

run().catch(console.error);
