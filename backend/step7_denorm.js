const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Starting bulk denormalization...');
  
  // 1. Denormalize Clubs
  const clubs = await prisma.club.findMany({
    include: {
      clubCompetitions: {
        include: { competition: true }
      }
    }
  });

  console.log(`Updating ${clubs.length} clubs...`);
  for (const c of clubs) {
    const competitions = c.clubCompetitions.map(cc => cc.competition.name);
    await prisma.club.update({
      where: { id: c.id },
      data: { competitions }
    });
  }

  // 2. Denormalize Players
  // To avoid memory issues and speed up, chunk players
  const players = await prisma.player.findMany({ select: { id: true } });
  console.log(`Updating ${players.length} players...`);

  let count = 0;
  // We'll process them in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE).map(p => p.id);
    
    // Fetch all related PlayerClub data for this batch
    const playerClubs = await prisma.playerClub.findMany({
      where: { playerId: { in: batch } },
      include: {
        club: {
          select: {
            name: true,
            competitions: true,
          }
        }
      },
      orderBy: [
        { isCurrent: 'desc' },
        { startYear: 'asc' },
      ]
    });

    // Group by playerId
    const pcMap = {};
    for (const pc of playerClubs) {
      if (!pcMap[pc.playerId]) pcMap[pc.playerId] = [];
      pcMap[pc.playerId].push(pc);
    }

    // Process each player in batch
    for (const pid of batch) {
      const pcs = pcMap[pid] || [];
      const clubsSeen = new Set();
      const clubsArray = [];
      const compsSeen = new Set();

      for (const pc of pcs) {
        if (!clubsSeen.has(pc.club.name)) {
          clubsSeen.add(pc.club.name);
          clubsArray.push(pc.club.name);
        }
        for (const comp of pc.club.competitions) {
          compsSeen.add(comp);
        }
      }

      await prisma.player.update({
        where: { id: pid },
        data: {
          clubs: clubsArray,
          competitions: Array.from(compsSeen)
        }
      });

      count++;
    }
    console.log(` Processed ${count} players...`);
  }

  console.log('Bulk denormalization complete.');
  await prisma.$disconnect();
}
run().catch(console.error);
