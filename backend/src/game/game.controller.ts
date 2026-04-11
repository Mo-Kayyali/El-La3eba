import { Controller, Get } from '@nestjs/common';
import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';

@Controller('game')
export class GameController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('leaderboard')
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.leaderboardService.getLeaderboard();
  }
}
