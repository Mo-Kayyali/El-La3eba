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
import { PrismaModule } from '../prisma/prisma.module';
import { GameModule } from '../game/game.module';

@Module({
  imports: [PrismaModule, GameModule],
  controllers: [
    AdminController,
    AdminCompetitionsController,
    AdminClubsController,
    AdminPlayersController,
    AdminQuestionsController
  ],
  providers: [
    AdminCompetitionsService,
    AdminClubsService,
    AdminPlayersService,
    AdminQuestionsService
  ],
})
export class AdminModule {}
