const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Countries:', await prisma.country.count());
  console.log('Competitions:', await prisma.competition.count());
  console.log('Clubs:', await prisma.club.count());
  console.log('ClubCompetitions:', await prisma.clubCompetition.count());
  console.log('Players:', await prisma.player.count());
  console.log('PlayerClubs:', await prisma.playerClub.count());

  await prisma.$disconnect();
}
run();
