const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function run() {
  const players = JSON.parse(fs.readFileSync('../clean_players.json', 'utf-8'));
  const mappings = JSON.parse(fs.readFileSync('../club_mapping.json', 'utf-8'));
  const clubNameToId = mappings.clubNameToId;

  // Insert UNK country just in case
  await prisma.country.upsert({
    where: { id: 'UNK' },
    update: {},
    create: { id: 'UNK', name: 'Unknown' }
  });

  const playerBatch = [];
  const playerClubBatch = [];

  for (const p of players) {
    let firstName = p.firstName;
    let lastName = p.lastName;
    
    // Alias generation logic
    if (!firstName && !lastName) {
      const parts = p.fullName.trim().split(/\s+/);
      if (parts.length === 2) {
        firstName = parts[0];
        lastName = parts[1];
      } else {
        firstName = p.fullName.trim();
        lastName = "";
      }
    } else {
      firstName = firstName || p.fullName.trim();
      lastName = lastName || "";
    }

    const aliases = new Set(p.aliases || []);
    if (firstName && firstName !== p.fullName) aliases.add(firstName);
    if (lastName && lastName !== p.fullName) aliases.add(lastName);
    if (firstName && lastName && `${firstName} ${lastName}` !== p.fullName) aliases.add(`${firstName} ${lastName}`);
    aliases.delete(p.fullName);

    // Date parsing
    let dob = null;
    if (p.dob) {
      const d = new Date(p.dob);
      if (!isNaN(d.valueOf())) dob = d.toISOString();
    }

    // Resolve current club ID
    let currentClubId = null;
    if (p.currentClub) {
      currentClubId = clubNameToId[p.currentClub.toLowerCase()];
    }

    // Prepare Player row
    playerBatch.push({
      id: p.id,
      firstName: firstName,
      lastName: lastName,
      name: p.fullName,
      aliases: Array.from(aliases),
      nationality: p.nationality || 'UNK',
      dateOfBirth: dob,
      heightCm: p.heightCm,
      preferredFoot: p.preferredFoot,
      positions: p.position ? [p.position] : [],
      primaryPosition: p.position || null,
      isRetired: p.isRetired === null ? false : p.isRetired,
      currentClubId: currentClubId,
      clubs: [], // denorm later
      competitions: [] // denorm later
    });

    // Prepare PlayerClub history
    if (p.history && p.history.length > 0) {
      // dedupe player-club associations just to be safe
      const seenClubs = new Set();
      
      for (const h of p.history) {
        const cId = clubNameToId[h.club.toLowerCase()];
        if (cId) {
          // Avoid duplicate (playerId, clubId) in the batch if endYear/startYear overlaps or is redundant
          const historyKey = `${p.id}_${cId}`;
          if (!seenClubs.has(historyKey)) {
            seenClubs.add(historyKey);
            const isCurrent = (h.club.toLowerCase() === (p.currentClub || '').toLowerCase()) || (!p.isRetired && h.end_year === null);
            playerClubBatch.push({
              id: uuidv4(),
              playerId: p.id,
              clubId: cId,
              startYear: h.start_year || null,
              endYear: h.end_year || null,
              isCurrent: isCurrent
            });
          }
        }
      }
    }
  }

  // Insert in chunks of 5000
  console.log(`Inserting ${playerBatch.length} players...`);
  for (let i = 0; i < playerBatch.length; i += 5000) {
    await prisma.player.createMany({
      data: playerBatch.slice(i, i + 5000),
      skipDuplicates: true
    });
    console.log(` Inserted players up to ${Math.min(i + 5000, playerBatch.length)}`);
  }

  console.log(`Inserting ${playerClubBatch.length} player-clubs...`);
  for (let i = 0; i < playerClubBatch.length; i += 5000) {
    await prisma.playerClub.createMany({
      data: playerClubBatch.slice(i, i + 5000),
      skipDuplicates: true
    });
    console.log(` Inserted player-clubs up to ${Math.min(i + 5000, playerClubBatch.length)}`);
  }

  console.log('Done seeding players and histories.');
  await prisma.$disconnect();
}
run().catch(e => {
  console.error(e);
  process.exit(1);
});
