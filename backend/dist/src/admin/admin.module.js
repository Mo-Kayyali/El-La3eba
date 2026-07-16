"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminModule = void 0;
const common_1 = require("@nestjs/common");
const admin_controller_1 = require("./admin.controller");
const competitions_controller_1 = require("./competitions.controller");
const competitions_service_1 = require("./competitions.service");
const clubs_controller_1 = require("./clubs.controller");
const clubs_service_1 = require("./clubs.service");
const players_controller_1 = require("./players.controller");
const players_service_1 = require("./players.service");
const questions_controller_1 = require("./questions.controller");
const questions_service_1 = require("./questions.service");
const prisma_module_1 = require("../prisma/prisma.module");
const game_module_1 = require("../game/game.module");
let AdminModule = class AdminModule {
};
exports.AdminModule = AdminModule;
exports.AdminModule = AdminModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, game_module_1.GameModule],
        controllers: [
            admin_controller_1.AdminController,
            competitions_controller_1.AdminCompetitionsController,
            clubs_controller_1.AdminClubsController,
            players_controller_1.AdminPlayersController,
            questions_controller_1.AdminQuestionsController
        ],
        providers: [
            competitions_service_1.AdminCompetitionsService,
            clubs_service_1.AdminClubsService,
            players_service_1.AdminPlayersService,
            questions_service_1.AdminQuestionsService
        ],
    })
], AdminModule);
//# sourceMappingURL=admin.module.js.map