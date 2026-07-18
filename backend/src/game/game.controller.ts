import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaderboardService, LeaderboardEntry } from './leaderboard.service';
import { MatchmakingService } from './matchmaking.service';
import { GameService } from './game.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Game')
@Controller('game')
export class GameController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly matchmakingService: MatchmakingService,
    private readonly gameService: GameService,
  ) {}

  @Get('leaderboard')
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return this.leaderboardService.getLeaderboard();
  }

  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Active in-progress game session for the current user (Redis)',
  })
  @UseGuards(JwtAuthGuard)
  @Get('active-game')
  async getActiveGame(@Request() req: { user: { userId: string } }) {
    const gameSessionId =
      await this.matchmakingService.getActiveGameSessionIdForUser(
        req.user.userId,
      );
    return { gameSessionId };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit an answer suggestion for a rejected guess' })
  @UseGuards(JwtAuthGuard)
  @Post('suggestions')
  async createSuggestion(
    @Request() req: { user: { userId: string } },
    @Body() body: { questionId: string; playerId?: string | null; guessText: string; comment?: string },
  ) {
    if (!body.questionId || !body.guessText) {
      return { status: 'error', message: 'Missing required fields' };
    }
    return this.gameService.createSuggestion(
      req.user.userId,
      body.questionId,
      body.playerId || null,
      body.guessText,
      body.comment,
    );
  }
}
