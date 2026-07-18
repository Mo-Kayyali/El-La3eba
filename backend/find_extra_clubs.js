const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const cleanClubs = JSON.parse(fs.readFileSync('../clean_clubs.json', 'utf-8'));
  const cleanClubNames = new Set(cleanClubs.map(c => c.clean_name.toLowerCase()));
  
  const allDbClubs = await prisma.club.findMany();
  
  const extraClubs = allDbClubs.filter(c => !cleanClubNames.has(c.name.toLowerCase()));
  
  console.log(`Current DB Club Count: ${allDbClubs.length}`);
  console.log(`Extra clubs found (not matching exactly in clean_clubs.json): ${extraClubs.length}`);
  if (extraClubs.length > 0) {
    extraClubs.forEach(c => console.log(` - ID: ${c.id}, Name: "${c.name}", Country: ${c.countryCode || 'null'}, Logo: ${c.logoUrl ? 'Yes' : 'No'}`));
  }
  
  await prisma.$disconnect();
}

run().catch(console.error);
