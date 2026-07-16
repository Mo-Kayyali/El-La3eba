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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminQuestionsController = void 0;
const common_1 = require("@nestjs/common");
const questions_service_1 = require("./questions.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
const game_service_1 = require("../game/game.service");
let AdminQuestionsController = class AdminQuestionsController {
    questionsService;
    gameService;
    constructor(questionsService, gameService) {
        this.questionsService = questionsService;
        this.gameService = gameService;
    }
    create(createDto) {
        return this.questionsService.create(createDto);
    }
    findAll(gameMode, isActive) {
        const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
        return this.questionsService.findAll(gameMode, activeFilter);
    }
    findOne(id) {
        return this.questionsService.findOne(id);
    }
    update(id, updateDto) {
        return this.questionsService.update(id, updateDto);
    }
    remove(id) {
        return this.questionsService.remove(id);
    }
    async testGuess(id, guessName) {
        const question = await this.questionsService.findOne(id);
        if (!question)
            return { error: 'Question not found' };
        const matches = await this.gameService.guessPlayer(guessName);
        if (!matches || matches.length === 0)
            return { matchedPlayer: null, isCorrect: false };
        let bestMatch = null;
        let isCorrect = false;
        for (const match of matches) {
            const valid = await this.gameService.validateAnswer(question, match);
            if (valid) {
                bestMatch = match;
                isCorrect = true;
                break;
            }
        }
        if (!bestMatch)
            bestMatch = matches[0];
        return {
            matchedPlayer: bestMatch,
            isCorrect,
        };
    }
};
exports.AdminQuestionsController = AdminQuestionsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [questions_service_1.CreateQuestionDto]),
    __metadata("design:returntype", void 0)
], AdminQuestionsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('gameMode')),
    __param(1, (0, common_1.Query)('isActive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], AdminQuestionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminQuestionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, questions_service_1.PatchQuestionDto]),
    __metadata("design:returntype", void 0)
], AdminQuestionsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminQuestionsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/test-guess'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('guessName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AdminQuestionsController.prototype, "testGuess", null);
exports.AdminQuestionsController = AdminQuestionsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Controller)('admin/questions'),
    __metadata("design:paramtypes", [questions_service_1.AdminQuestionsService,
        game_service_1.GameService])
], AdminQuestionsController);
//# sourceMappingURL=questions.controller.js.map