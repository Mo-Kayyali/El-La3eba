const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== EXECUTE CLEANUP ===\n');

  // 1. Delete 5 orphaned players
  const orphanedNames = ['Pau Cubarsi', 'Pedri', 'Denzel Dumfries', 'Marc Cucurella', 'Jude Bellingham'];
  const resPlayers = await prisma.player.deleteMany({
    where: {
      name: { in: orphanedNames },
      dateOfBirth: null
    }
  });
  console.log(`Deleted ${resPlayers.count} orphaned test players.`);

  // 2. Delete 3 stray competitions
  const strayComps = ['Egyptian League', 'Champions League', 'World Cup'];
  const resComps = await prisma.competition.deleteMany({
    where: {
      name: { in: strayComps }
    }
  });
  console.log(`Deleted ${resComps.count} stray competitions.`);

  // 3. Delete all test questions
  const resQuestions = await prisma.question.deleteMany({});
  console.log(`Deleted ${resQuestions.count} questions.`);

  console.log('\n=== FINAL SANITY CHECK ===');
  const playerCount = await prisma.player.count();
  const compCount = await prisma.competition.count();
  const questionCount = await prisma.question.count();

  console.log(`Players: ${playerCount} (Expected: 14472)`);
  console.log(`Competitions: ${compCount} (Expected: 18)`);
  console.log(`Questions: ${questionCount} (Expected: 0)`);

  await prisma.$disconnect();
}

run().catch(console.error);
