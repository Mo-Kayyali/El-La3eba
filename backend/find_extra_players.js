const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const cleanPlayers = JSON.parse(fs.readFileSync('../clean_players.json', 'utf-8'));
  const cleanPlayerIds = new Set(cleanPlayers.map(p => p.id));
  
  const allDbPlayers = await prisma.player.findMany({
    select: { id: true, name: true, dateOfBirth: true }
  });
  
  const extraPlayers = allDbPlayers.filter(p => !cleanPlayerIds.has(p.id));
  
  console.log(`Current DB Player Count: ${allDbPlayers.length}`);
  console.log(`Extra players found (not in clean_players.json): ${extraPlayers.length}`);
  if (extraPlayers.length > 0) {
    extraPlayers.forEach(p => console.log(` - ID: ${p.id}, Name: ${p.name}, DOB: ${p.dateOfBirth}`));
  }
  
  await prisma.$disconnect();
}

run().catch(console.error);
