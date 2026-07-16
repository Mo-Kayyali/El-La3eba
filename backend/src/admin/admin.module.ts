import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCompetitionsController } from './competitions.controller';
import { AdminCompetitionsService } from './competitions.service';
import { AdminClubsController } from './clubs.controller';
import { AdminClubsService } from './clubs.service';
import { AdminPlayersController } from './players.controller';
import { AdminPlayersService } from './players.service';
import { GameModule } from '../game/game.module';

@Module({
  imports: [GameModule],
  controllers: [AdminController, AdminCompetitionsController, AdminClubsController, AdminPlayersController],
  providers: [AdminCompetitionsService, AdminClubsService, AdminPlayersService],
})
export class AdminModule {}
