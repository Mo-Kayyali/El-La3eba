import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCompetitionsController } from './competitions.controller';
import { AdminCompetitionsService } from './competitions.service';
import { AdminClubsController } from './clubs.controller';
import { AdminClubsService } from './clubs.service';
import { AdminPlayersController } from './players.controller';
import { AdminPlayersService } from './players.service';
import { AdminQuestionsController } from './questions.controller';
import { AdminQuestionsService } from './questions.service';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';
import { PrismaModule } from '../prisma/prisma.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [PrismaModule, GameModule],
  controllers: [
    AdminController,
    AdminCompetitionsController,
    AdminClubsController,
    AdminPlayersController,
    AdminQuestionsController,
    SuggestionsController,
  ],
  providers: [
    AdminCompetitionsService,
    AdminClubsService,
    AdminPlayersService,
    AdminQuestionsService,
    SuggestionsService,
  ],
})
export class AdminModule {}
