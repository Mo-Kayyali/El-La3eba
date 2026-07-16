import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { capitalizeWords } from '../utils/string.util';
import { GameMode, AnswerType, FilterType, LogicOperator } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsUUID, IsInt, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionAnswerDto {
  @IsUUID()
  playerId: string;

  @IsOptional()
  @IsInt()
  rank?: number;

  @IsOptional()
  @IsString()
  slotLabel?: string;
}

export class QuestionFilterClauseDto {
  @IsEnum(FilterType)
  filterType: FilterType;

  @IsString()
  filterValue: string;

  @IsOptional()
  currentClubOnly?: boolean;
}

export class CreateQuestionDto {
  @IsString()
  text: string;

  @IsEnum(GameMode)
  gameMode: GameMode;

  @IsOptional()
  @IsEnum(AnswerType)
  answerType?: AnswerType;

  @IsOptional()
  @IsEnum(LogicOperator)
  logicOperator?: LogicOperator;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionFilterClauseDto)
  clauses?: QuestionFilterClauseDto[];

  @IsOptional()
  @IsUUID()
  photoPlayerId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerDto)
  answers?: QuestionAnswerDto[];

  @IsOptional()
  @IsEnum(['ANY', 'CURRENT_ONLY', 'RETIRED_ONLY'])
  playerStatusFilter?: any;

  @IsOptional()
  isActive?: boolean;
}

export class PatchQuestionDto extends CreateQuestionDto {}

@Injectable()
export class AdminQuestionsService {
  constructor(private prisma: PrismaService) {}

  async validateShape(dto: CreateQuestionDto | PatchQuestionDto) {
    let { gameMode, answerType, logicOperator, photoPlayerId, answers, clauses } = dto;
    answers = answers || [];
    clauses = clauses || [];

    // Auto-set answerType
    if (gameMode === GameMode.TOP_10 || gameMode === GameMode.LINEUP || gameMode === GameMode.PHOTO_GUESS) {
      answerType = AnswerType.LIST;
    }

    if (gameMode === GameMode.PHOTO_GUESS) {
      if (!photoPlayerId) throw new BadRequestException('photoPlayerId is required for PHOTO_GUESS');
      if (answers.length > 0) throw new BadRequestException('answers array must be empty for PHOTO_GUESS');
    }

    if (answerType === AnswerType.FILTER) {
      if (clauses.length === 0) throw new BadRequestException('at least 1 clause required for FILTER');
      if (clauses.length > 1 && !logicOperator) throw new BadRequestException('logicOperator required when there are multiple clauses');
      if (answers.length > 0) throw new BadRequestException('answers array must be empty for FILTER');
    }

    if (answerType === AnswerType.LIST && gameMode !== GameMode.PHOTO_GUESS) {
      if (answers.length === 0) throw new BadRequestException('at least 1 answer required for LIST');
      
      const playerIds = new Set<string>();
      const ranks = new Set<number>();
      const slots = new Set<string>();

      for (const a of answers) {
        if (!a.playerId) throw new BadRequestException('playerId is required in answers');
        if (playerIds.has(a.playerId)) throw new BadRequestException(`Duplicate playerId: ${a.playerId}`);
        playerIds.add(a.playerId);

        if (gameMode === GameMode.TOP_10) {
          if (!a.rank) throw new BadRequestException('rank is required for TOP_10 answers');
          if (ranks.has(a.rank)) throw new BadRequestException(`Duplicate rank: ${a.rank}`);
          ranks.add(a.rank);
        } else if (gameMode === GameMode.LINEUP) {
          if (!a.slotLabel) throw new BadRequestException('slotLabel is required for LINEUP answers');
          if (slots.has(a.slotLabel)) throw new BadRequestException(`Duplicate slotLabel: ${a.slotLabel}`);
          slots.add(a.slotLabel);
        }
      }
      
      // FK existence check
      const idsToCheck = [...playerIds];
      const foundPlayers = await this.prisma.player.count({ where: { id: { in: idsToCheck } } });
      if (foundPlayers !== idsToCheck.length) {
        throw new BadRequestException('One or more playerId references are invalid');
      }
    }

    if (photoPlayerId) {
      const found = await this.prisma.player.findUnique({ where: { id: photoPlayerId } });
      if (!found) throw new BadRequestException('photoPlayerId reference is invalid');
    }

    return { gameMode, answerType, logicOperator: logicOperator || null, photoPlayerId, answers, clauses };
  }

  async create(createDto: CreateQuestionDto) {
    createDto.text = capitalizeWords(createDto.text);
    const validated = await this.validateShape(createDto);

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.create({
        data: {
          text: createDto.text,
          gameMode: validated.gameMode,
          answerType: validated.answerType!,
          logicOperator: validated.logicOperator,
          photoPlayerId: validated.photoPlayerId || null,
          playerStatusFilter: createDto.playerStatusFilter || 'ANY',
          isActive: createDto.isActive ?? true,
        }
      });

      if (validated.clauses.length > 0) {
        await tx.questionFilterClause.createMany({
          data: validated.clauses.map(c => ({
            questionId: question.id,
            filterType: c.filterType,
            filterValue: c.filterValue,
            currentClubOnly: c.currentClubOnly ?? false,
          }))
        });
      }

      if (validated.answers.length > 0) {
        await tx.questionAnswer.createMany({
          data: validated.answers.map(a => ({
            questionId: question.id,
            playerId: a.playerId,
            rank: a.rank || null,
            slotLabel: a.slotLabel || null
          }))
        });
      }

      return question;
    });
  }

  findAll(gameMode?: GameMode, isActive?: boolean) {
    const where: any = {};
    if (gameMode) where.gameMode = gameMode;
    if (isActive !== undefined) where.isActive = isActive;
    
    return this.prisma.question.findMany({
      where,
      include: {
        _count: { select: { answers: true } },
        clauses: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: string) {
    return this.prisma.question.findUnique({
      where: { id },
      include: {
        answers: {
          include: { player: { select: { name: true, aliases: true, imageUrl: true } } },
          orderBy: { rank: 'asc' }
        },
        photoPlayer: { select: { name: true, imageUrl: true } },
        clauses: true
      }
    });
  }

  async update(id: string, updateDto: PatchQuestionDto) {
    if (updateDto.text) updateDto.text = capitalizeWords(updateDto.text);
    const validated = await this.validateShape(updateDto);

    return this.prisma.$transaction(async (tx) => {
      const question = await tx.question.update({
        where: { id },
        data: {
          text: updateDto.text,
          gameMode: validated.gameMode,
          answerType: validated.answerType!,
          logicOperator: validated.logicOperator,
          photoPlayerId: validated.photoPlayerId || null,
          playerStatusFilter: updateDto.playerStatusFilter || 'ANY',
          isActive: updateDto.isActive ?? true,
        }
      });

      await tx.questionAnswer.deleteMany({
        where: { questionId: id }
      });
      await tx.questionFilterClause.deleteMany({
        where: { questionId: id }
      });

      if (validated.clauses.length > 0) {
        await tx.questionFilterClause.createMany({
          data: validated.clauses.map(c => ({
            questionId: id,
            filterType: c.filterType,
            filterValue: c.filterValue,
            currentClubOnly: c.currentClubOnly ?? false,
          }))
        });
      }

      if (validated.answers.length > 0) {
        await tx.questionAnswer.createMany({
          data: validated.answers.map(a => ({
            questionId: id,
            playerId: a.playerId,
            rank: a.rank || null,
            slotLabel: a.slotLabel || null
          }))
        });
      }

      return question;
    });
  }

  async remove(id: string) {
    try {
      await this.prisma.question.delete({ where: { id } });
      return { success: true };
    } catch (err: any) {
      if (err.code === 'P2003') {
        throw new ConflictException('Cannot delete question because it is referenced by answer suggestions');
      }
      throw err;
    }
  }
}
