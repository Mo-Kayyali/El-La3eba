const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const cleanPlayers = JSON.parse(fs.readFileSync('clean_players.json', 'utf-8'));
  const cleanClubs = JSON.parse(fs.readFileSync('clean_clubs.json', 'utf-8'));
  const crosswalk = JSON.parse(fs.readFileSync('country_crosswalk.json', 'utf-8'));

  const codeToName = {};
  for (const [name, code] of Object.entries(crosswalk)) {
    if (!codeToName[code]) {
      codeToName[code] = name;
    }
  }

  const usedCodes = new Set();
  
  for (const p of cleanPlayers) {
    if (p.nationality) usedCodes.add(p.nationality);
  }
  for (const c of cleanClubs) {
    if (c.countryCode) usedCodes.add(c.countryCode);
  }

  const countriesToInsert = [];
  for (const code of usedCodes) {
    const name = codeToName[code] || code; // Fallback to code if name not in crosswalk
    countriesToInsert.push({ id: code, name: name });
  }

  console.log(`Found ${countriesToInsert.length} unique referenced countries.`);

  const result = await prisma.country.createMany({
    data: countriesToInsert,
    skipDuplicates: true,
  });

  console.log(`Inserted ${result.count} country rows.`);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
