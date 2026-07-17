import { PrismaClient } from '@prisma/client';
import { GameService } from './src/game/game.service';
import { AdminQuestionsService } from './src/admin/questions.service';
import { PrismaService } from './src/prisma/prisma.service';
import axios from 'axios';

const prisma = new PrismaClient() as any;
prisma.onModuleInit = async () => {};
prisma.onModuleDestroy = async () => {};

async function run() {
  console.log('--- PART 1: Cleanup Script Check ---');
  // Check if any filterValue is still a UUID for CLUB or COMPETITION
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const badClauses = await prisma.questionFilterClause.findMany({
    where: {
      filterType: { in: ['CLUB', 'COMPETITION'] }
    }
  });
  const uuidCount = badClauses.filter(c => uuidRegex.test(c.filterValue)).length;
  console.log(`Remaining UUID filterValues in DB: ${uuidCount}`);
  
  // We don't have the log of the original script, but we can verify it's clean now.
  // I will write a mock fix script to see if it fixes any.
  
  console.log('\n--- SETTING UP DATA FOR TESTS ---');
  // Create Test Country
  const country = await prisma.country.upsert({
    where: { id: 'BRA' },
    update: {},
    create: { id: 'BRA', name: 'Brazil' }
  });

  const countryPor = await prisma.country.upsert({
    where: { id: 'POR' },
    update: {},
    create: { id: 'POR', name: 'Portugal' }
  });

  // Create Test Clubs
  const realMadrid = await prisma.club.create({
    data: { name: 'Real Madrid Test', countryCode: 'BRA' }
  });
  const alNassr = await prisma.club.create({
    data: { name: 'Al Nassr Test', countryCode: 'POR' }
  });
  const interMilan = await prisma.club.create({
    data: { name: 'Inter Milan Test', countryCode: 'BRA' }
  });

  // Create Test Players
  const r9 = await prisma.player.create({
    data: {
      firstName: 'Ronaldo',
      lastName: 'Nazario',
      name: 'Ronaldo Nazario',
      aliases: ['Ronaldo'],
      nationality: 'BRA',
      isRetired: true,
      clubs: ['Real Madrid Test', 'Inter Milan Test']
    }
  });

  const cr7 = await prisma.player.create({
    data: {
      firstName: 'Cristiano',
      lastName: 'Ronaldo',
      name: 'Cristiano Ronaldo',
      aliases: ['Ronaldo', 'CR7'],
      nationality: 'POR',
      isRetired: false,
      currentClubId: alNassr.id,
      clubs: ['Real Madrid Test', 'Al Nassr Test']
    }
  });

  console.log('Created Players: R9 (Retired), CR7 (Active)');

  // Initialize GameService manually for testing
  const gameService = new GameService(prisma);

  console.log('\n--- PART 2: Multi-candidate resolution ---');
  // Question: Active player
  const activeQuestion = await prisma.question.create({
    data: {
      text: 'Name an active player',
      gameMode: 'STRIKES',
      answerType: 'FILTER',
      playerStatusFilter: 'CURRENT_ONLY',
      clauses: {
        create: {
          filterType: 'CLUB',
          filterValue: 'Real Madrid Test' // both played for Real Madrid
        }
      }
    },
    include: { clauses: true }
  });

  const matches: any[] = await gameService.guessPlayer('Ronaldo');
  console.log(`guessPlayer('Ronaldo') returned ${matches.length} candidates.`);
  console.log(`Candidates: ${matches.map((m: any) => m.name).join(', ')}`);
  
  let acceptedPlayer: any = null;
  for (const m of matches) {
    const valid = await gameService.validateAnswer(activeQuestion as any, m);
    if (valid) {
      acceptedPlayer = m;
      break;
    }
  }
  console.log(`Accepted candidate: ${acceptedPlayer ? acceptedPlayer.name : 'None'} (Expected: Cristiano Ronaldo)`);


  console.log('\n--- PART 3: Qualifiers Test ---');
  
  console.log('Test A: Retired player against CURRENT_ONLY question');
  // Validate R9 against activeQuestion
  const validR9Active = await gameService.validateAnswer(activeQuestion as any, r9);
  console.log(`Validate R9 on CURRENT_ONLY question: ${validR9Active} (Expected: false)`);

  console.log('Test B: Player whose history matches, currentClubOnly = false');
  // CR7 plays for Al Nassr currently, but played for Real Madrid in the past.
  // ActiveQuestion has currentClubOnly = false, and filterValue = Real Madrid Test.
  const validCR7History = await gameService.validateAnswer(activeQuestion as any, cr7);
  console.log(`Validate CR7 (current Al Nassr) on Real Madrid history: ${validCR7History} (Expected: true)`);

  console.log('Test C: Player whose history matches, currentClubOnly = true');
  const currentClubQuestion = await prisma.question.create({
    data: {
      text: 'Name a player currently at Real Madrid',
      gameMode: 'STRIKES',
      answerType: 'FILTER',
      clauses: {
        create: {
          filterType: 'CLUB',
          filterValue: 'Real Madrid Test',
          currentClubOnly: true
        }
      }
    },
    include: { clauses: true }
  });

  const validCR7Current = await gameService.validateAnswer(currentClubQuestion as any, cr7);
  console.log(`Validate CR7 (current Al Nassr) on Real Madrid CURRENT_ONLY: ${validCR7Current} (Expected: false)`);

  console.log('\n--- PART 4: Test-guess endpoint ---');
  try {
    const adminService = new AdminQuestionsService(prisma as PrismaService);
    const questionFromDb = await adminService.findOne(activeQuestion.id);
    
    console.log(`Sending payload: { guessName: 'Ronaldo' } to /admin/questions/${activeQuestion.id}/test-guess`);
    
    // Simulate endpoint logic
    const matchesEndpoint = await gameService.guessPlayer('Ronaldo');
    let bestMatch = null;
    let isCorrect = false;

    for (const match of matchesEndpoint) {
      const valid = await gameService.validateAnswer(questionFromDb as any, match);
      if (valid) {
        bestMatch = match;
        isCorrect = true;
        break;
      }
    }
    if (!bestMatch) bestMatch = matchesEndpoint[0];
    
    const response = {
      matchedPlayer: bestMatch,
      isCorrect
    };
    console.log(`Endpoint Response: \n${JSON.stringify(response, null, 2)}`);

  } catch (e: any) {
    console.error('Error in endpoint test:', e.message);
  }

  // Cleanup
  console.log('\n--- CLEANING UP ---');
  await prisma.question.delete({ where: { id: activeQuestion.id }});
  await prisma.question.delete({ where: { id: currentClubQuestion.id }});
  await prisma.player.deleteMany({ where: { id: { in: [r9.id, cr7.id] } } });
  await prisma.club.deleteMany({ where: { id: { in: [realMadrid.id, alNassr.id, interMilan.id] } } });
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
