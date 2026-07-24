import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
import { AdminQuestionsService, CreateQuestionDto, PatchQuestionDto } from './questions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role, GameMode } from '@prisma/client';
import { GameService } from '../game/game.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/questions')
export class AdminQuestionsController {
  constructor(
    private readonly questionsService: AdminQuestionsService,
    private readonly gameService: GameService
  ) {}

  @Post()
  create(@Body() createDto: CreateQuestionDto, @Req() req: any) {
    return this.questionsService.create(createDto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('gameMode') gameMode?: GameMode,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.questionsService.findAll({
      gameMode,
      isActive: activeFilter,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      sort,
      order,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.questionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: PatchQuestionDto, @Req() req: any) {
    return this.questionsService.update(id, updateDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.questionsService.remove(id);
  }

  @Post(':id/test-guess')
  async testGuess(@Param('id') id: string, @Body('guessName') guessName: string) {
    const question = await this.questionsService.findOne(id);
    if (!question) return { error: 'Question not found' };

    const matches = await this.gameService.guessPlayer(guessName);
    if (!matches || matches.length === 0) {
      return { matchedPlayer: null, isCorrect: false, isAmbiguous: false, candidates: [] };
    }

    const topCandidate = matches[0];
    const isAmbiguous = topCandidate.isAmbiguous ?? false;
    const matchedPlayer = isAmbiguous ? null : topCandidate;

    let isCorrect = false;
    if (matchedPlayer) {
      isCorrect = await this.gameService.validateAnswer(question as any, matchedPlayer);
    }

    const detailedCandidates = await Promise.all(
      matches.slice(0, 5).map(async (c: any, index: number) => {
        const candidateValid = await this.gameService.validateAnswer(question as any, c);
        const isPicked = !isAmbiguous && index === 0;
        return {
          id: c.id,
          name: c.name,
          bestTarget: c.bestTarget || c.name,
          matchConfidence: c.matchConfidence,
          nationality: c.nationality,
          currentClubName: c.currentClubName || null,
          isPicked,
          isCorrect: candidateValid,
        };
      }),
    );

    return {
      matchedPlayer,
      isCorrect,
      isAmbiguous,
      candidates: detailedCandidates,
    };
  }
}
