const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function run() {
  const stints = [
    { playerName: 'Ahmed Hossam Mido', clubName: 'Zamalek', startYear: 2009, endYear: 2010 },
    { playerName: 'Ahmed Hossam Mido', clubName: 'Zamalek', startYear: 2011, endYear: 2012 },
    { playerName: 'Mohamed Shawky', clubName: 'Al Ahly', startYear: 2010, endYear: 2012 },
    { playerName: 'Saleh Selim', clubName: 'Al Ahly', startYear: 1963, endYear: 1967 },
    { playerName: 'Tarek El-Said', clubName: 'Zamalek', startYear: 2002, endYear: 2006 },
    { playerName: 'Hassan Shehata', clubName: 'Zamalek', startYear: 1971, endYear: 1983 }
  ];

  let restoredCount = 0;
  for (const s of stints) {
    const player = await prisma.player.findFirst({ where: { name: s.playerName } });
    const club = await prisma.club.findFirst({ where: { name: s.clubName } });

    if (player && club) {
      await prisma.playerClub.create({
        data: {
          id: uuidv4(),
          playerId: player.id,
          clubId: club.id,
          startYear: s.startYear,
          endYear: s.endYear,
          isCurrent: false
        }
      });
      restoredCount++;
    }
  }

  console.log(`Successfully restored ${restoredCount} distinct multi-stints.`);
  await prisma.$disconnect();
}
run().catch(console.error);
