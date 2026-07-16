import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { GameService } from './src/game/game.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gameService = app.get(GameService);
  
  console.log("Fetching random STRIKES question...");
  const q = await gameService.getRandomQuestion('STRIKES');
  console.log("Result:", q);
  
  await app.close();
}
bootstrap();
