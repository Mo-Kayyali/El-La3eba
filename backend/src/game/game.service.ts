import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { evaluateMatch } from './guess-matcher.util';
import { POSITION_CATEGORY_MAP } from './position.util';
import { GameMode, AnswerType, FilterType, Position, Question } from '@prisma/client';

// AI REFEREE BLUEPRINT — uncomment when activating:
// import axios from 'axios';
// (also move \`axios\` from devDependencies to dependencies in package.json)

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async guessPlayer(guessName: string): Promise<any[]> {
    const normalizedGuess = guessName.trim().replace(/-/g, ' ');
    const guessLen = normalizedGuess.length;
    if (guessLen < 3) return [];

    const [_, candidates] = await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.2;`),
      this.prisma.$queryRaw<any[]>`
        WITH guess AS (
          SELECT lower(unaccent(${normalizedGuess})) AS val
        ),
        player_metrics AS (
          SELECT 
            p.*,
            c.name as "currentClubName",
            c.competitions as "currentClubCompetitions",
            g.val,
            GREATEST(
              word_similarity(g.val, replace(lower(unaccent_immutable(p.name)), '-', ' ')),
              word_similarity(g.val, replace(lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))), '-', ' '))
            ) as w_sim
          FROM "Player" p
          LEFT JOIN "Club" c ON p."currentClubId" = c.id
          CROSS JOIN guess g
          WHERE
            -- Generous prefilter to narrow candidates via GIN index
            (
              lower(unaccent_immutable(p.name)) %> g.val OR
              lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> g.val
            )
        )
        SELECT *
        FROM player_metrics
        ORDER BY w_sim DESC
        LIMIT 20;
      `
    ]);

    // Apply TS Token-Level Matcher
    const scoredCandidates = candidates.map(c => {
      let bestConfidence = 0;
      const targets = [c.name, ...(c.aliases || [])];
      for (const target of targets) {
        const result = evaluateMatch(normalizedGuess, target);
        if (result.confidence > bestConfidence) {
          bestConfidence = result.confidence;
        }
      }
      return { ...c, matchConfidence: bestConfidence };
    });

    // Filter out completely irrelevant matches (e.g., confidence < 0.3)
    const validCandidates = scoredCandidates
      .filter(c => c.matchConfidence >= 0.3)
      .sort((a, b) => b.matchConfidence - a.matchConfidence)
      .slice(0, 10);

    if (validCandidates.length > 0) {
      const topScore = validCandidates[0].matchConfidence;
      
      // Ambiguity detection
      let isAmbiguous = false;
      if (topScore < 0.95 && validCandidates.length > 1) {
        const gap = topScore - validCandidates[1].matchConfidence;
        if (gap <= 0.05) {
          isAmbiguous = true;
        }
      }

      // We attach it to the first candidate, as the gateway checks matchedPlayers[0].isAmbiguous
      validCandidates[0].isAmbiguous = isAmbiguous;
    }

    return validCandidates;
  }

  async getRandomQuestion(gameMode: GameMode = 'STRIKES', excludeIds: string[] = []): Promise<Question | null> {
    let effectiveExclude = excludeIds;
    let availableCount = 0;

    if (effectiveExclude.length > 0) {
      availableCount = await this.prisma.question.count({
        where: { gameMode, id: { notIn: effectiveExclude } },
      });
      
      if (availableCount === 0) {
        // Exhaustion rule: keep only the most recently used question excluded
        effectiveExclude = [excludeIds[excludeIds.length - 1]];
        // Re-count with new exclusion rule
        availableCount = await this.prisma.question.count({
          where: { gameMode, id: { notIn: effectiveExclude } },
        });
      }
    } else {
      availableCount = await this.prisma.question.count({
        where: { gameMode },
      });
    }

    if (availableCount === 0) {
      // Fallback if there are literally no questions at all (or only 1 question that is excluded)
      return this.prisma.question.findFirst({ where: { gameMode }, include: { clauses: true } });
    }

    const skip = Math.floor(Math.random() * availableCount);
    const questions = await this.prisma.question.findMany({
      where: { gameMode, id: { notIn: effectiveExclude } },
      skip,
      take: 1,
      include: { clauses: true },
    });
    
    return questions[0] || null;
  }

  async validateAnswer(question: Question & { playerStatusFilter?: string }, player: any): Promise<boolean> {
    if (!question || !player) return false;

    if (question.playerStatusFilter === 'CURRENT_ONLY' && player.isRetired) return false;
    if (question.playerStatusFilter === 'RETIRED_ONLY' && !player.isRetired) return false;

    if (question.answerType === 'FILTER') {
      const clauses = (question as any).clauses || [];
      if (clauses.length === 0) return false;

      const evaluateClause = (clause: any) => {
        if (clause.filterType === 'COMPETITION') {
          if (clause.timeframe === 'CURRENT') {
            return player.currentClubCompetitions?.includes(clause.filterValue) ?? false;
          } else if (clause.timeframe === 'PAST') {
            return (player.competitions?.includes(clause.filterValue) && !player.currentClubCompetitions?.includes(clause.filterValue)) ?? false;
          } else {
            return player.competitions?.includes(clause.filterValue) ?? false;
          }
        } else if (clause.filterType === 'CLUB') {
          if (clause.timeframe === 'CURRENT') {
            return player.currentClubName === clause.filterValue;
          } else if (clause.timeframe === 'PAST') {
            return (player.clubs?.includes(clause.filterValue) && player.currentClubName !== clause.filterValue) ?? false;
          } else {
            return player.clubs?.includes(clause.filterValue) ?? false;
          }
        } else if (clause.filterType === 'NATIONALITY') {
          return player.nationality === clause.filterValue;
        } else if (clause.filterType === 'POSITION') {
          return player.positions?.includes(clause.filterValue) ?? false;
        } else if (clause.filterType === 'POSITION_CATEGORY') {
          return player.positionCategories?.includes(clause.filterValue) ?? false;
        }
        return false;
      };

      if (question.logicOperator === 'OR') {
        return clauses.some(evaluateClause);
      } else {
        return clauses.every(evaluateClause);
      }
    } else if (question.answerType === 'LIST') {
      const qa = await this.prisma.questionAnswer.findUnique({
        where: {
          questionId_playerId: {
            questionId: question.id,
            playerId: player.id,
          },
        },
      });
      return !!qa;
    }

    return false;
  }

  async validateAndGetAnswerDetails(questionId: string, playerId: string): Promise<{ rank?: number | null, slotLabel?: string | null } | null> {
    const qa = await this.prisma.questionAnswer.findUnique({
      where: {
        questionId_playerId: {
          questionId,
          playerId,
        },
      },
    });
    if (!qa) return null;
    return {
      rank: qa.rank,
      slotLabel: qa.slotLabel,
    };
  }

  // ─── AI Referee Blueprint ─────────────────────────────────────────────────
  //
  // When the Python microservice at http://localhost:8000 is ready:
  //
  // async checkSuggestionWithAI(questionId: string, guessText: string): Promise<boolean> {
  //   try {
  //     const response = await axios.post('http://localhost:8000/referee/check', {
  //       question_id: questionId,
  //       guess_text: guessText
  //     });
  //     return response.data.is_correct === true;
  //   } catch (error) {
  //     console.error('AI Referee error:', error.message);
  //     return false; // Fallback to rejected if AI is unreachable
  //   }
  // }

  async createSuggestion(
    userId: string,
    questionId: string,
    playerId: string | null,
    guessText: string,
    comment?: string,
  ) {
    const existing = await this.prisma.answerSuggestion.findFirst({
      where: {
        suggestedBy: userId,
        questionId,
        ...(playerId ? { playerId } : { guessText }),
        status: 'PENDING',
      },
    });

    if (existing) {
      return {
        status: 'error',
        message: 'You have already suggested this answer for this question.',
      };
    }

    const suggestion = await this.prisma.answerSuggestion.create({
      data: {
        questionId,
        playerId: playerId as any,
        guessText,
        suggestedBy: userId,
        comment,
        status: 'PENDING',
      },
    });

    return { status: 'ok', suggestion };
  }
}
