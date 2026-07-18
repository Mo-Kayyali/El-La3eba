const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const p = await prisma.player.findFirst({
    where: { clubs: { isEmpty: false } }
  });
  console.log('Sample Player Denormalized Array:');
  console.log('Name:', p.name);
  console.log('Clubs:', p.clubs);
  console.log('Competitions:', p.competitions);
  
  const c = await prisma.club.findFirst({
    where: { competitions: { isEmpty: false } }
  });
  console.log('\nSample Club Denormalized Array:');
  console.log('Name:', c.name);
  console.log('Competitions:', c.competitions);

  await prisma.$disconnect();
}
run();
