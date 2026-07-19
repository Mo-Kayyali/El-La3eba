"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const guess_matcher_util_1 = require("./guess-matcher.util");
let GameService = class GameService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async guessPlayer(guessName) {
        const normalizedGuess = guessName.trim().replace(/-/g, ' ');
        const guessLen = normalizedGuess.length;
        if (guessLen < 3)
            return [];
        const [_, candidates] = await this.prisma.$transaction([
            this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.2;`),
            this.prisma.$queryRaw `
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
        const scoredCandidates = candidates.map(c => {
            let bestConfidence = 0;
            const targets = [c.name, ...(c.aliases || [])];
            for (const target of targets) {
                const result = (0, guess_matcher_util_1.evaluateMatch)(normalizedGuess, target);
                if (result.confidence > bestConfidence) {
                    bestConfidence = result.confidence;
                }
            }
            return { ...c, matchConfidence: bestConfidence };
        });
        const validCandidates = scoredCandidates
            .filter(c => c.matchConfidence >= 0.3)
            .sort((a, b) => b.matchConfidence - a.matchConfidence)
            .slice(0, 10);
        if (validCandidates.length > 0) {
            const topScore = validCandidates[0].matchConfidence;
            let isAmbiguous = false;
            if (topScore < 0.95 && validCandidates.length > 1) {
                const gap = topScore - validCandidates[1].matchConfidence;
                if (gap <= 0.05) {
                    isAmbiguous = true;
                }
            }
            validCandidates[0].isAmbiguous = isAmbiguous;
        }
        return validCandidates;
    }
    async getRandomQuestion(gameMode = 'STRIKES', excludeIds = []) {
        let effectiveExclude = excludeIds;
        let availableCount = 0;
        if (effectiveExclude.length > 0) {
            availableCount = await this.prisma.question.count({
                where: { gameMode, id: { notIn: effectiveExclude } },
            });
            if (availableCount === 0) {
                effectiveExclude = [excludeIds[excludeIds.length - 1]];
                availableCount = await this.prisma.question.count({
                    where: { gameMode, id: { notIn: effectiveExclude } },
                });
            }
        }
        else {
            availableCount = await this.prisma.question.count({
                where: { gameMode },
            });
        }
        if (availableCount === 0) {
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
    async validateAnswer(question, player) {
        if (!question || !player)
            return false;
        if (question.playerStatusFilter === 'CURRENT_ONLY' && player.isRetired)
            return false;
        if (question.playerStatusFilter === 'RETIRED_ONLY' && !player.isRetired)
            return false;
        if (question.answerType === 'FILTER') {
            const clauses = question.clauses || [];
            if (clauses.length === 0)
                return false;
            const evaluateClause = (clause) => {
                if (clause.filterType === 'COMPETITION') {
                    if (clause.timeframe === 'CURRENT') {
                        return player.currentClubCompetitions?.includes(clause.filterValue) ?? false;
                    }
                    else if (clause.timeframe === 'PAST') {
                        return (player.competitions?.includes(clause.filterValue) && !player.currentClubCompetitions?.includes(clause.filterValue)) ?? false;
                    }
                    else {
                        return player.competitions?.includes(clause.filterValue) ?? false;
                    }
                }
                else if (clause.filterType === 'CLUB') {
                    if (clause.timeframe === 'CURRENT') {
                        return player.currentClubName === clause.filterValue;
                    }
                    else if (clause.timeframe === 'PAST') {
                        return (player.clubs?.includes(clause.filterValue) && player.currentClubName !== clause.filterValue) ?? false;
                    }
                    else {
                        return player.clubs?.includes(clause.filterValue) ?? false;
                    }
                }
                else if (clause.filterType === 'NATIONALITY') {
                    return player.nationality === clause.filterValue;
                }
                else if (clause.filterType === 'POSITION') {
                    return player.positions?.includes(clause.filterValue) ?? false;
                }
                else if (clause.filterType === 'POSITION_CATEGORY') {
                    return player.positionCategories?.includes(clause.filterValue) ?? false;
                }
                return false;
            };
            if (question.logicOperator === 'OR') {
                return clauses.some(evaluateClause);
            }
            else {
                return clauses.every(evaluateClause);
            }
        }
        else if (question.answerType === 'LIST') {
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
    async createSuggestion(userId, questionId, playerId, guessText, comment) {
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
                playerId: playerId,
                guessText,
                suggestedBy: userId,
                comment,
                status: 'PENDING',
            },
        });
        return { status: 'ok', suggestion };
    }
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GameService);
//# sourceMappingURL=game.service.js.map