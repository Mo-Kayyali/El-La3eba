const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function run() {
  const cleanClubs = JSON.parse(fs.readFileSync('../clean_clubs.json', 'utf-8'));
  const compMapping = JSON.parse(fs.readFileSync('../competition_mapping.json', 'utf-8'));

  let clubsInserted = 0;
  let clubCompetitionsInserted = 0;

  const clubIdMapping = {}; // For linking players later
  const clubNameToId = {};

  for (const c of cleanClubs) {
    const realCompId = compMapping[c.competition_id];
    let clubUuid = uuidv4(); // Generate a real UUID for every club

    // Save mappings
    if (c.source_batch === 'egypt_manual') {
      clubNameToId[c.clean_name.toLowerCase()] = clubUuid;
    } else {
      clubIdMapping[String(c.club_id)] = clubUuid;
      clubIdMapping[String(c.club_id).replace('.0', '')] = clubUuid;
      clubNameToId[c.clean_name.toLowerCase()] = clubUuid;
    }

    const aliases = [];
    if (c.clean_name !== c.club_slug && c.club_slug) {
      aliases.push(c.club_slug.replace(/-/g, ' '));
    }

    await prisma.club.create({
      data: {
        id: clubUuid,
        name: c.clean_name,
        aliases: aliases,
        countryCode: c.countryCode,
        currentCompetitionId: realCompId || null,
        logoUrl: c.logo_url || null,
        competitions: [] // Will be denormalized later
      }
    });
    clubsInserted++;

    if (realCompId) {
      await prisma.clubCompetition.create({
        data: {
          id: uuidv4(),
          clubId: clubUuid,
          competitionId: realCompId
        }
      });
      clubCompetitionsInserted++;
    }
  }

  // Save mapping for Step 6
  fs.writeFileSync('../club_mapping.json', JSON.stringify({ clubIdMapping, clubNameToId }, null, 2));

  console.log(`Inserted ${clubsInserted} clubs and ${clubCompetitionsInserted} ClubCompetition rows.`);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
