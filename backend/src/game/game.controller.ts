import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Game')
@Controller('game')
export class GameController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  @Get('leaderboard')
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.leaderboardService.getLeaderboard();
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Active in-progress game session for the current user (Redis)' })
  @UseGuards(JwtAuthGuard)
  @Get('active-game')
  async getActiveGame(@Request() req: { user: { userId: string } }) {
    const gameSessionId = await this.matchmakingService.getActiveGameSessionIdForUser(
      req.user.userId,
    );
    return { gameSessionId };
  }
}
