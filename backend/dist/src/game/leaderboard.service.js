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
var LeaderboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let LeaderboardService = class LeaderboardService {
    static { LeaderboardService_1 = this; }
    prisma;
    redisClient;
    logger = new common_1.Logger(LeaderboardService_1.name);
    static CACHE_KEY = 'global_leaderboard';
    CACHE_TTL = 7200;
    constructor(prisma, redisClient) {
        this.prisma = prisma;
        this.redisClient = redisClient;
    }
    async refreshLeaderboard() {
        try {
            const topUsers = await this.prisma.user.findMany({
                orderBy: { mmr: 'desc' },
                take: 10,
                select: {
                    id: true,
                    username: true,
                    mmr: true,
                    wins: true,
                    gamesPlayed: true,
                },
            });
            await this.redisClient.set(LeaderboardService_1.CACHE_KEY, JSON.stringify(topUsers), 'EX', this.CACHE_TTL);
            this.logger.log(`Leaderboard refreshed — ${topUsers.length} entries cached (top MMR: ${topUsers[0]?.mmr ?? 'n/a'})`);
        }
        catch (error) {
            const err = error;
            this.logger.error(`Failed to refresh leaderboard: ${err?.message}`, err?.stack);
        }
    }
    async getLeaderboard() {
        const cached = await this.redisClient.get(LeaderboardService_1.CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
        this.logger.warn('Leaderboard cache miss — querying DB directly');
        await this.refreshLeaderboard();
        const fresh = await this.redisClient.get(LeaderboardService_1.CACHE_KEY);
        return fresh ? JSON.parse(fresh) : [];
    }
};
exports.LeaderboardService = LeaderboardService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LeaderboardService.prototype, "refreshLeaderboard", null);
exports.LeaderboardService = LeaderboardService = LeaderboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], LeaderboardService);
//# sourceMappingURL=leaderboard.service.js.map