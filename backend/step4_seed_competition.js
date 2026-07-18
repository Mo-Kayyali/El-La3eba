const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

const competitions = [
  { sourceId: 'ES1', name: 'LaLiga', countryCode: 'ESP', tier: 1 },
  { sourceId: 'ES2', name: 'LaLiga2', countryCode: 'ESP', tier: 2 },
  { sourceId: 'IT1', name: 'Serie A', countryCode: 'ITA', tier: 1 },
  { sourceId: 'IT2', name: 'Serie B', countryCode: 'ITA', tier: 2 },
  { sourceId: 'GB1', name: 'Premier League', countryCode: 'ENG', tier: 1 },
  { sourceId: 'GB2', name: 'Championship', countryCode: 'ENG', tier: 2 },
  { sourceId: 'FR1', name: 'Ligue 1', countryCode: 'FRA', tier: 1 },
  { sourceId: 'FR2', name: 'Ligue 2', countryCode: 'FRA', tier: 2 },
  { sourceId: 'L1', name: 'Bundesliga', countryCode: 'DEU', tier: 1 },
  { sourceId: 'L2', name: '2. Bundesliga', countryCode: 'DEU', tier: 2 },
  { sourceId: 'BE1', name: 'Jupiler Pro League', countryCode: 'BEL', tier: 1 },
  { sourceId: 'PO1', name: 'Liga Portugal', countryCode: 'PRT', tier: 1 },
  { sourceId: 'MLS1', name: 'Major League Soccer', countryCode: 'USA', tier: 1 },
  { sourceId: 'TR1', name: 'Süper Lig', countryCode: 'TUR', tier: 1 },
  { sourceId: 'BRA1', name: 'Campeonato Brasileiro Série A', countryCode: 'BRA', tier: 1 },
  { sourceId: 'ARGC', name: 'Torneo Clausura', countryCode: 'ARG', tier: 1 },
  { sourceId: 'EGY1', name: 'Egyptian Premier League', countryCode: 'EGY', tier: 1 },
  { sourceId: 'EGY2', name: 'Egyptian Second Division A', countryCode: 'EGY', tier: 2 }
];

async function run() {
  const compMapping = {};
  let inserted = 0;

  for (const c of competitions) {
    // Check if competition already exists by name and countryCode
    let existing = await prisma.competition.findFirst({
      where: { name: c.name, countryCode: c.countryCode }
    });

    if (!existing) {
      existing = await prisma.competition.create({
        data: {
          id: uuidv4(),
          name: c.name,
          type: 'DOMESTIC_LEAGUE',
          countryCode: c.countryCode,
          tier: c.tier
        }
      });
      inserted++;
    }
    
    compMapping[c.sourceId] = existing.id;
  }

  // Save the mapping for the next step
  fs.writeFileSync('../competition_mapping.json', JSON.stringify(compMapping, null, 2));

  console.log(`Successfully created ${inserted} new competitions. (Total mapped: 18)`);
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
