const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Fetching players with missing last names...');
  
  // We'll just fetch all players, or those where lastName is "" or null.
  const allPlayers = await prisma.player.findMany();
  const players = allPlayers.filter(p => p.lastName === null || p.lastName === '');

  console.log(`Found ${players.length} players with empty last name.`);

  let patchedCount = 0;
  for (const p of players) {
    if (p.firstName) {
      const parts = p.firstName.trim().split(/\s+/);
      if (parts.length > 1) {
        const newFirst = parts[0];
        const newLast = parts.slice(1).join(' ');

        await prisma.player.update({
          where: { id: p.id },
          data: {
            firstName: newFirst,
            lastName: newLast
          }
        });
        patchedCount++;
      }
    }
  }

  console.log(`Successfully split names for ${patchedCount} players.`);
  await prisma.$disconnect();
}

run().catch(console.error);
