"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModule = void 0;
const common_1 = require("@nestjs/common");
const game_gateway_1 = require("./game.gateway");
const game_controller_1 = require("./game.controller");
const auth_module_1 = require("../auth/auth.module");
const redis_module_1 = require("../redis/redis.module");
const matchmaking_service_1 = require("./matchmaking.service");
const game_service_1 = require("./game.service");
const leaderboard_service_1 = require("./leaderboard.service");
const player_denorm_service_1 = require("./player-denorm.service");
const club_denorm_service_1 = require("./club-denorm.service");
const prisma_module_1 = require("../prisma/prisma.module");
const friends_module_1 = require("../friends/friends.module");
const users_module_1 = require("../users/users.module");
let GameModule = class GameModule {
};
exports.GameModule = GameModule;
exports.GameModule = GameModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            redis_module_1.RedisModule,
            prisma_module_1.PrismaModule,
            users_module_1.UsersModule,
            (0, common_1.forwardRef)(() => friends_module_1.FriendsModule),
        ],
        controllers: [game_controller_1.GameController],
        providers: [game_gateway_1.GameGateway, matchmaking_service_1.MatchmakingService, game_service_1.GameService, leaderboard_service_1.LeaderboardService, player_denorm_service_1.PlayerDenormService, club_denorm_service_1.ClubDenormService],
        exports: [game_gateway_1.GameGateway, player_denorm_service_1.PlayerDenormService, club_denorm_service_1.ClubDenormService],
    })
], GameModule);
//# sourceMappingURL=game.module.js.map