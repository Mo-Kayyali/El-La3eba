const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const cleanClubs = JSON.parse(fs.readFileSync('../clean_clubs.json', 'utf-8'));
const clubMap = {};
cleanClubs.forEach(c => {
  clubMap[c.clean_name.toLowerCase()] = c.club_id; // wait, do I need DB id?
});

async function run() {
  const targetRows = new Set();
  for (let i = 14593; i <= 14656; i++) targetRows.add(i);

  let currentRow = 1;
  const playersData = [];

  console.log('Parsing CSV to extract active players...');
  await new Promise((resolve, reject) => {
    fs.createReadStream('../RAW_ALL_PLAYERS.csv')
      .pipe(csv())
      .on('data', (row) => {
        currentRow++;
        if (targetRows.has(currentRow)) {
          let name = row.name || row.player_name || row.fullName;
          let clubName = row.current_club_if_active || row.club;
          
          if (clubName === 'Pyramids FC') clubName = 'Pyramids';
          if (clubName === 'Ismaily SC') clubName = 'Ismaily';
          if (clubName === 'ZED FC') clubName = 'ZED';
          if (clubName === 'Bank El Ahly') clubName = 'National Bank of Egypt';

          if (name && clubName) {
            playersData.push({ name: name.trim(), clubName: clubName.trim() });
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`Found ${playersData.length} players to patch.`);

  let patchedCount = 0;
  for (const { name, clubName } of playersData) {
    // find club in db
    const club = await prisma.club.findFirst({ where: { name: clubName } });
    if (!club) {
      console.log(`Club not found in DB: ${clubName}`);
      continue;
    }

    // find player in db
    const player = await prisma.player.findFirst({ where: { name } });
    if (!player) {
      console.log(`Player not found in DB: ${name}`);
      continue;
    }

    // set currentClubId
    await prisma.player.update({
      where: { id: player.id },
      data: { currentClubId: club.id }
    });

    // check if playerclub exists
    const existingStint = await prisma.playerClub.findFirst({
      where: { playerId: player.id, clubId: club.id, isCurrent: true }
    });

    if (!existingStint) {
      await prisma.playerClub.create({
        data: {
          id: uuidv4(),
          playerId: player.id,
          clubId: club.id,
          startYear: 2020, // default if missing? Or just null
          isCurrent: true
        }
      });
    }
    patchedCount++;
  }

  console.log(`Successfully patched ${patchedCount} active players.`);
  await prisma.$disconnect();
}

run().catch(console.error);
