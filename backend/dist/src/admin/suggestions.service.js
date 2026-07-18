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
exports.SuggestionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SuggestionsService = class SuggestionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getAllSuggestions(filters = {}) {
        const whereClause = filters.status ? { status: filters.status } : {};
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;
        const total = await this.prisma.answerSuggestion.count({ where: whereClause });
        const data = await this.prisma.answerSuggestion.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
                question: true,
                player: true,
                suggester: {
                    select: { id: true, username: true, email: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        return {
            data,
            meta: {
                total,
                page,
                totalPages: Math.ceil(total / limit)
            }
        };
    }
    async approveSuggestion(id, reviewNote) {
        const suggestion = await this.prisma.answerSuggestion.findUnique({
            where: { id },
            include: { question: true },
        });
        if (!suggestion) {
            throw new common_1.NotFoundException('Suggestion not found');
        }
        let message = 'Suggestion approved.';
        let createdAnswer = false;
        if (suggestion.question.answerType === 'LIST') {
            const existing = await this.prisma.questionAnswer.findUnique({
                where: {
                    questionId_playerId: {
                        questionId: suggestion.questionId,
                        playerId: suggestion.playerId,
                    },
                },
            });
            if (!existing) {
                await this.prisma.questionAnswer.create({
                    data: {
                        questionId: suggestion.questionId,
                        playerId: suggestion.playerId,
                    },
                });
                createdAnswer = true;
                message = 'Suggestion approved and new QuestionAnswer created for LIST question.';
            }
            else {
                message = 'Suggestion approved, but QuestionAnswer already existed.';
            }
        }
        else {
            message = 'Suggestion approved for FILTER question. Admin recorded judgment signal.';
        }
        const updated = await this.prisma.answerSuggestion.update({
            where: { id },
            data: {
                status: 'APPROVED',
                reviewNote,
                reviewedAt: new Date(),
            },
        });
        return { status: 'ok', message, createdAnswer, suggestion: updated };
    }
    async rejectSuggestion(id, reviewNote) {
        const suggestion = await this.prisma.answerSuggestion.update({
            where: { id },
            data: {
                status: 'REJECTED',
                reviewNote,
                reviewedAt: new Date(),
            },
        });
        return { status: 'ok', message: 'Suggestion rejected.', suggestion };
    }
};
exports.SuggestionsService = SuggestionsService;
exports.SuggestionsService = SuggestionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SuggestionsService);
//# sourceMappingURL=suggestions.service.js.map