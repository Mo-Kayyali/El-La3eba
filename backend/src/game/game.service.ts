import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { POSITION_CATEGORY_MAP } from './position.util';
import { GameMode, AnswerType, FilterType, Position, Question } from '@prisma/client';

// AI REFEREE BLUEPRINT — uncomment when activating:
// import axios from 'axios';
// (also move \`axios\` from devDependencies to dependencies in package.json)

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async guessPlayer(guessName: string): Promise<any> {
    const normalizedGuess = guessName.trim();
    const guessLen = normalizedGuess.length;
    if (guessLen < 3) return null;

    let allowedTypos = 0;
    if (guessLen >= 8) allowedTypos = 2;
    else if (guessLen >= 5) allowedTypos = 1;

    const [_, matches] = await this.prisma.$transaction([
      this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.15;`),
      this.prisma.$queryRaw<any[]>`
        WITH guess AS (
          SELECT lower(unaccent(${normalizedGuess})) AS val
        ),
        player_metrics AS (
          SELECT 
            p.*,
            g.val,
            -- Best edit distance to the FULL name or any FULL alias within length tolerance
            (
              SELECT min(levenshtein(lower(unaccent(alias)), g.val))
              FROM unnest(array_append(p.aliases, p.name)) as alias
              WHERE abs(char_length(g.val) - char_length(alias)) <= 3
            ) as best_dist,
            -- Trigram similarity against both name and aliases for sorting (and pre-filtering)
            GREATEST(
              word_similarity(g.val, lower(unaccent_immutable(p.name))),
              word_similarity(g.val, lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))))
            ) as w_sim
          FROM "Player" p, guess g
          WHERE
            -- Generous prefilter to narrow candidates via GIN index (if configured) or fast discard
            (
              lower(unaccent_immutable(p.name)) %> g.val OR
              lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> g.val
            )
        )
        SELECT *
        FROM player_metrics
        WHERE 
          best_dist <= ${allowedTypos}
        ORDER BY 
          w_sim DESC,
          best_dist ASC
        LIMIT 1;
      `
    ]);

    return matches.length > 0 ? matches[0] : null;
  }

  async getRandomQuestion(gameMode: GameMode = 'STRIKES', excludeIds: string[] = []): Promise<Question | null> {
    let effectiveExclude = excludeIds;

    if (effectiveExclude.length > 0) {
      const countWithExclusion = await this.prisma.question.count({
        where: { gameMode, id: { notIn: effectiveExclude } },
      });
      
      if (countWithExclusion === 0) {
        // Exhaustion rule: keep only the most recently used question excluded
        effectiveExclude = [excludeIds[excludeIds.length - 1]];
      }
    }

    const availableCount = await this.prisma.question.count({
      where: { gameMode, id: { notIn: effectiveExclude } },
    });

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

  async validateAnswer(question: Question, player: any): Promise<boolean> {
    if (!question || !player) return false;

    if (question.answerType === 'FILTER') {
      const clauses = (question as any).clauses || [];
      if (clauses.length === 0) return false;

      const evaluateClause = (clause: any) => {
        if (clause.filterType === 'COMPETITION') {
          return player.competitions?.includes(clause.filterValue) ?? false;
        } else if (clause.filterType === 'CLUB') {
          return player.clubs?.includes(clause.filterValue) ?? false;
        } else if (clause.filterType === 'NATIONALITY') {
          return player.nationality === clause.filterValue;
        } else if (clause.filterType === 'POSITION') {
          return player.positions?.includes(clause.filterValue) ?? false;
        } else if (clause.filterType === 'POSITION_CATEGORY') {
          const allowedPositions = clause.filterValue ? POSITION_CATEGORY_MAP[clause.filterValue] || [] : [];
          return player.positions?.some((p: string) => allowedPositions.includes(p)) ?? false;
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
    playerId: string,
    guessText: string,
    comment?: string,
  ) {
    const existing = await this.prisma.answerSuggestion.findFirst({
      where: {
        suggestedBy: userId,
        questionId,
        playerId,
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
        playerId,
        guessText,
        suggestedBy: userId,
        comment,
        status: 'PENDING',
      },
    });

    return { status: 'ok', suggestion };
  }
}
