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
exports.AdminQuestionsService = exports.PatchQuestionDto = exports.CreateQuestionDto = exports.QuestionFilterClauseDto = exports.QuestionAnswerDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const string_util_1 = require("../utils/string.util");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class QuestionAnswerDto {
    playerId;
    rank;
    slotLabel;
}
exports.QuestionAnswerDto = QuestionAnswerDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], QuestionAnswerDto.prototype, "playerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], QuestionAnswerDto.prototype, "rank", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuestionAnswerDto.prototype, "slotLabel", void 0);
class QuestionFilterClauseDto {
    filterType;
    filterValue;
    currentClubOnly;
}
exports.QuestionFilterClauseDto = QuestionFilterClauseDto;
__decorate([
    (0, class_validator_1.IsEnum)(client_1.FilterType),
    __metadata("design:type", String)
], QuestionFilterClauseDto.prototype, "filterType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuestionFilterClauseDto.prototype, "filterValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], QuestionFilterClauseDto.prototype, "currentClubOnly", void 0);
class CreateQuestionDto {
    text;
    gameMode;
    answerType;
    logicOperator;
    clauses;
    photoPlayerId;
    answers;
    playerStatusFilter;
    isActive;
}
exports.CreateQuestionDto = CreateQuestionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.GameMode),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "gameMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.AnswerType),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "answerType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.LogicOperator),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "logicOperator", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => QuestionFilterClauseDto),
    __metadata("design:type", Array)
], CreateQuestionDto.prototype, "clauses", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "photoPlayerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => QuestionAnswerDto),
    __metadata("design:type", Array)
], CreateQuestionDto.prototype, "answers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(['ANY', 'CURRENT_ONLY', 'RETIRED_ONLY']),
    __metadata("design:type", Object)
], CreateQuestionDto.prototype, "playerStatusFilter", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateQuestionDto.prototype, "isActive", void 0);
class PatchQuestionDto extends CreateQuestionDto {
}
exports.PatchQuestionDto = PatchQuestionDto;
let AdminQuestionsService = class AdminQuestionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async validateShape(dto) {
        let { gameMode, answerType, logicOperator, photoPlayerId, answers, clauses } = dto;
        answers = answers || [];
        clauses = clauses || [];
        if (gameMode === client_1.GameMode.TOP_10 || gameMode === client_1.GameMode.LINEUP || gameMode === client_1.GameMode.PHOTO_GUESS) {
            answerType = client_1.AnswerType.LIST;
        }
        if (gameMode === client_1.GameMode.PHOTO_GUESS) {
            if (!photoPlayerId)
                throw new common_1.BadRequestException('photoPlayerId is required for PHOTO_GUESS');
            if (answers.length > 0)
                throw new common_1.BadRequestException('answers array must be empty for PHOTO_GUESS');
        }
        if (answerType === client_1.AnswerType.FILTER) {
            if (clauses.length === 0)
                throw new common_1.BadRequestException('at least 1 clause required for FILTER');
            if (clauses.length > 1 && !logicOperator)
                throw new common_1.BadRequestException('logicOperator required when there are multiple clauses');
            if (answers.length > 0)
                throw new common_1.BadRequestException('answers array must be empty for FILTER');
        }
        if (answerType === client_1.AnswerType.LIST && gameMode !== client_1.GameMode.PHOTO_GUESS) {
            if (answers.length === 0)
                throw new common_1.BadRequestException('at least 1 answer required for LIST');
            const playerIds = new Set();
            const ranks = new Set();
            const slots = new Set();
            for (const a of answers) {
                if (!a.playerId)
                    throw new common_1.BadRequestException('playerId is required in answers');
                if (playerIds.has(a.playerId))
                    throw new common_1.BadRequestException(`Duplicate playerId: ${a.playerId}`);
                playerIds.add(a.playerId);
                if (gameMode === client_1.GameMode.TOP_10) {
                    if (!a.rank)
                        throw new common_1.BadRequestException('rank is required for TOP_10 answers');
                    if (ranks.has(a.rank))
                        throw new common_1.BadRequestException(`Duplicate rank: ${a.rank}`);
                    ranks.add(a.rank);
                }
                else if (gameMode === client_1.GameMode.LINEUP) {
                    if (!a.slotLabel)
                        throw new common_1.BadRequestException('slotLabel is required for LINEUP answers');
                    if (slots.has(a.slotLabel))
                        throw new common_1.BadRequestException(`Duplicate slotLabel: ${a.slotLabel}`);
                    slots.add(a.slotLabel);
                }
            }
            const idsToCheck = [...playerIds];
            const foundPlayers = await this.prisma.player.count({ where: { id: { in: idsToCheck } } });
            if (foundPlayers !== idsToCheck.length) {
                throw new common_1.BadRequestException('One or more playerId references are invalid');
            }
        }
        if (photoPlayerId) {
            const found = await this.prisma.player.findUnique({ where: { id: photoPlayerId } });
            if (!found)
                throw new common_1.BadRequestException('photoPlayerId reference is invalid');
        }
        return { gameMode, answerType, logicOperator: logicOperator || null, photoPlayerId, answers, clauses };
    }
    async create(createDto) {
        createDto.text = (0, string_util_1.capitalizeWords)(createDto.text);
        const validated = await this.validateShape(createDto);
        return this.prisma.$transaction(async (tx) => {
            const question = await tx.question.create({
                data: {
                    text: createDto.text,
                    gameMode: validated.gameMode,
                    answerType: validated.answerType,
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
    findAll(gameMode, isActive) {
        const where = {};
        if (gameMode)
            where.gameMode = gameMode;
        if (isActive !== undefined)
            where.isActive = isActive;
        return this.prisma.question.findMany({
            where,
            include: {
                _count: { select: { answers: true } },
                clauses: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }
    findOne(id) {
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
    async update(id, updateDto) {
        if (updateDto.text)
            updateDto.text = (0, string_util_1.capitalizeWords)(updateDto.text);
        const validated = await this.validateShape(updateDto);
        return this.prisma.$transaction(async (tx) => {
            const question = await tx.question.update({
                where: { id },
                data: {
                    text: updateDto.text,
                    gameMode: validated.gameMode,
                    answerType: validated.answerType,
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
    async remove(id) {
        try {
            await this.prisma.question.delete({ where: { id } });
            return { success: true };
        }
        catch (err) {
            if (err.code === 'P2003') {
                throw new common_1.ConflictException('Cannot delete question because it is referenced by answer suggestions');
            }
            throw err;
        }
    }
};
exports.AdminQuestionsService = AdminQuestionsService;
exports.AdminQuestionsService = AdminQuestionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminQuestionsService);
//# sourceMappingURL=questions.service.js.map