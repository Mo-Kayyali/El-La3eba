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
const position_util_1 = require("./position.util");
let GameService = class GameService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async guessPlayer(guessName) {
        const normalizedGuess = guessName.trim();
        const guessLen = normalizedGuess.length;
        if (guessLen < 3)
            return [];
        let allowedTypos = 0;
        if (guessLen >= 8)
            allowedTypos = 2;
        else if (guessLen >= 5)
            allowedTypos = 1;
        const [_, matches] = await this.prisma.$transaction([
            this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.15;`),
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
          FROM "Player" p
          LEFT JOIN "Club" c ON p."currentClubId" = c.id
          CROSS JOIN guess g
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
        LIMIT 5;
      `
        ]);
        return matches;
    }
    async getRandomQuestion(gameMode = 'STRIKES', excludeIds = []) {
        let effectiveExclude = excludeIds;
        if (effectiveExclude.length > 0) {
            const countWithExclusion = await this.prisma.question.count({
                where: { gameMode, id: { notIn: effectiveExclude } },
            });
            if (countWithExclusion === 0) {
                effectiveExclude = [excludeIds[excludeIds.length - 1]];
            }
        }
        const availableCount = await this.prisma.question.count({
            where: { gameMode, id: { notIn: effectiveExclude } },
        });
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
                    const allowedPositions = clause.filterValue ? position_util_1.POSITION_CATEGORY_MAP[clause.filterValue] || [] : [];
                    return player.positions?.some((p) => allowedPositions.includes(p)) ?? false;
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
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GameService);
//# sourceMappingURL=game.service.js.map