const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== STEP 1: PLAYERS ===');
  const testNames = ['Pau Cubarsi', 'Pedri', 'Denzel Dumfries', 'Marc Cucurella', 'Jude Bellingham'];
  for (const name of testNames) {
    const players = await prisma.player.findMany({
      where: { name },
      include: { playerClubs: true }
    });
    console.log(`\nName: ${name}`);
    for (const p of players) {
      console.log(`  - ID: ${p.id} | CreatedAt: ${p.createdAt ? p.createdAt.toISOString() : 'MISSING/NULL'} | PlayerClub Count: ${p.playerClubs.length} | DOB: ${p.dateOfBirth ? p.dateOfBirth.toISOString().split('T')[0] : 'null'}`);
    }
  }

  console.log('\n=== STEP 2: COMPETITIONS ===');
  const allComps = await prisma.competition.findMany({
    include: {
      clubs: true,
      clubCompetitions: true
    }
  });

  const validSet = new Set(['Premier League', 'Championship', 'LaLiga', 'LaLiga2', 'Serie A', 'Serie B', 'Bundesliga', '2. Bundesliga', 'Ligue 1', 'Ligue 2', 'Jupiler Pro League', 'Liga Portugal', 'Major League Soccer', 'Süper Lig', 'Campeonato Brasileiro Série A', 'Liga Profesional de Fútbol', 'Egyptian Premier League', 'Egyptian Second Division A']);

  const strayComps = allComps.filter(c => !validSet.has(c.name));
  
  if (strayComps.length === 0) {
    console.log('No stray competitions found.');
  } else {
    for (const c of strayComps) {
      console.log(`\nStray Competition: ${c.name} (ID: ${c.id})`);
      console.log(`  - currentCompetition for ${c.clubs.length} clubs.`);
      console.log(`  - ClubCompetition rows: ${c.clubCompetitions.length}`);
      if (c.clubs.length > 0) {
        console.log(`  - Clubs linked: ${c.clubs.map(x => x.name).join(', ')}`);
      }
      if (c.clubCompetitions.length > 0) {
         const linkedClubs = await prisma.club.findMany({
           where: { id: { in: c.clubCompetitions.map(cc => cc.clubId) } }
         });
         console.log(`  - ClubCompetition Clubs linked: ${linkedClubs.map(x => x.name).join(', ')}`);
      }
    }
  }

  console.log('\n=== STEP 3: QUESTIONS ===');
  const questions = await prisma.question.findMany({
    select: { id: true, text: true, createdAt: true }
  });

  if (questions.length === 0) {
    console.log('No questions found.');
  } else {
    for (const q of questions) {
      console.log(`- [${q.createdAt ? q.createdAt.toISOString() : 'NULL'}] ${q.text}`);
    }
  }

  await prisma.$disconnect();
}
run().catch(console.error);
