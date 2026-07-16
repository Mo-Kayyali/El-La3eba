import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCompetitionsController } from './competitions.controller';
import { AdminCompetitionsService } from './competitions.service';
import { AdminClubsController } from './clubs.controller';
import { AdminClubsService } from './clubs.service';

@Module({
  controllers: [AdminController, AdminCompetitionsController, AdminClubsController],
  providers: [AdminCompetitionsService, AdminClubsService],
})
export class AdminModule {}
