import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../../Programming/El-La3eba/backend/src/app.module';
import { GameService } from '../../../../Programming/El-La3eba/backend/src/game/game.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gameService = app.get(GameService);

  const testCases = [
    { guess: 'Cristian Ronaldo', expected: true },
    { guess: 'Cristiano', expected: false },
    { guess: 'Messy', expected: true },
    { guess: 'Kyliam Mbappe', expected: true },
    { guess: 'Leo Messi', expected: true },
    { guess: 'Lewy', expected: true },
    { guess: 'Vini', expected: true },
    { guess: 'CR7', expected: true }
  ];

  console.log('--- RUNNING TESTS ---');
  for (const tc of testCases) {
    const result = await gameService.guessPlayer(tc.guess);
    const accepted = !!result;
    console.log(`Guess: "${tc.guess}" -> Accepted: ${accepted} (Expected: ${tc.expected})`);
    if (accepted !== tc.expected) {
      console.error(`  [!] FAILED CASE: "${tc.guess}"`);
    } else {
      console.log(`  [OK]`);
    }
  }

  await app.close();
}

bootstrap();
