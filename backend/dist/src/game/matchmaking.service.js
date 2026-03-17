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
var MatchmakingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchmakingService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const redis_service_1 = require("../redis/redis.service");
const crypto_1 = require("crypto");
let MatchmakingService = MatchmakingService_1 = class MatchmakingService {
    redisClient;
    logger = new common_1.Logger(MatchmakingService_1.name);
    server;
    constructor(redisClient) {
        this.redisClient = redisClient;
    }
    setServer(server) {
        this.server = server;
    }
    async joinQueue(userId, socketId) {
        const queueData = JSON.stringify({ userId, socketId });
        await this.redisClient.lpush('matchmaking_queue', queueData);
        this.logger.log(`User ${userId} joined matchmaking queue`);
    }
    async leaveQueue(userId) {
        this.logger.log(`User ${userId} requested to leave matchmaking queue`);
    }
    async handleMatchmakingInterval() {
        if (!this.server)
            return;
        const queueLength = await this.redisClient.llen('matchmaking_queue');
        if (queueLength >= 2) {
            const player1Str = await this.redisClient.rpop('matchmaking_queue');
            const player2Str = await this.redisClient.rpop('matchmaking_queue');
            if (player1Str && player2Str) {
                const p1 = JSON.parse(player1Str);
                const p2 = JSON.parse(player2Str);
                if (p1.userId === p2.userId) {
                    await this.redisClient.lpush('matchmaking_queue', player1Str);
                    return;
                }
                const gameSessionId = (0, crypto_1.randomUUID)();
                const gameState = await this.initializeGameState(gameSessionId, p1.userId, p2.userId);
                this.server.in([p1.socketId, p2.socketId]).socketsJoin(gameSessionId);
                this.server.to(p1.socketId).emit('matchFound', { gameSessionId });
                this.server.to(p2.socketId).emit('matchFound', { gameSessionId });
                this.server.to(gameSessionId).emit('gameStateUpdated', { state: gameState });
                this.logger.log(`Match created: ${gameSessionId} [${p1.userId} vs ${p2.userId}]`);
            }
            else {
                if (player1Str)
                    await this.redisClient.lpush('matchmaking_queue', player1Str);
                if (player2Str)
                    await this.redisClient.lpush('matchmaking_queue', player2Str);
            }
        }
    }
    async createPrivateRoom(userId, socketId) {
        let roomCode = '';
        let isUnique = false;
        while (!isUnique) {
            roomCode = (0, crypto_1.randomBytes)(4).toString('hex').toUpperCase().slice(0, 6);
            const exists = await this.redisClient.exists(`private_room:${roomCode}`);
            if (!exists) {
                isUnique = true;
            }
        }
        const roomData = JSON.stringify({ userId, socketId });
        await this.redisClient.set(`private_room:${roomCode}`, roomData, 'EX', 1800);
        this.logger.log(`Private room ${roomCode} created by user ${userId}`);
        return roomCode;
    }
    async joinPrivateRoom(code, userId, socketId) {
        const uppercaseCode = code.toUpperCase();
        const roomDataStr = await this.redisClient.get(`private_room:${uppercaseCode}`);
        if (!roomDataStr) {
            return { success: false, error: 'Room not found or expired' };
        }
        const host = JSON.parse(roomDataStr);
        if (host.userId === userId) {
            return { success: false, error: 'You cannot join your own room' };
        }
        const gameSessionId = (0, crypto_1.randomUUID)();
        await this.redisClient.del(`private_room:${uppercaseCode}`);
        const gameState = await this.initializeGameState(gameSessionId, host.userId, userId);
        if (this.server) {
            this.server.in([host.socketId, socketId]).socketsJoin(gameSessionId);
            this.server.to(host.socketId).emit('matchFound', { gameSessionId });
            this.server.to(socketId).emit('matchFound', { gameSessionId });
            this.server.to(gameSessionId).emit('gameStateUpdated', { state: gameState });
        }
        this.logger.log(`Private match created: ${gameSessionId} [${host.userId} vs ${userId}]`);
        return { success: true, gameSessionId };
    }
    async initializeGameState(gameSessionId, player1Id, player2Id) {
        const gameState = {
            players: [player1Id, player2Id],
            currentTurn: player1Id,
            scores: { [player1Id]: 0, [player2Id]: 0 },
            overallScores: { [player1Id]: 0, [player2Id]: 0 },
            currentRound: 1,
            strikes: { [player1Id]: 0, [player2Id]: 0 },
            guessedPlayers: [],
            currentQuestion: "Name a football player who played in 2026",
        };
        await this.redisClient.set(`game:${gameSessionId}`, JSON.stringify(gameState));
        return gameState;
    }
};
exports.MatchmakingService = MatchmakingService;
__decorate([
    (0, schedule_1.Interval)(2000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MatchmakingService.prototype, "handleMatchmakingInterval", null);
exports.MatchmakingService = MatchmakingService = MatchmakingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], MatchmakingService);
//# sourceMappingURL=matchmaking.service.js.map