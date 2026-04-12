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
const prisma_service_1 = require("../prisma/prisma.service");
const crypto_1 = require("crypto");
const game_questions_1 = require("./game.questions");
const elo_util_1 = require("./elo.util");
let MatchmakingService = MatchmakingService_1 = class MatchmakingService {
    redisClient;
    prisma;
    logger = new common_1.Logger(MatchmakingService_1.name);
    server;
    startTurnTimerFn;
    QUEUES = {
        ranked: { list: 'ranked_queue', members: 'ranked_queue_members' },
        unrated: { list: 'unrated_queue', members: 'unrated_queue_members' },
    };
    constructor(redisClient, prisma) {
        this.redisClient = redisClient;
        this.prisma = prisma;
    }
    setServer(server) {
        this.server = server;
    }
    setTurnTimerStarter(fn) {
        this.startTurnTimerFn = fn;
    }
    async joinQueue(userId, socketId, username, mode) {
        const { list, members } = this.QUEUES[mode];
        const opposite = mode === 'ranked' ? 'unrated' : 'ranked';
        await this.redisClient.srem(this.QUEUES[opposite].members, userId);
        await this.cleanupUserPrivateRoom(userId);
        await this.redisClient.srem(members, userId);
        const entry = { userId, socketId, username };
        await this.redisClient.lpush(list, JSON.stringify(entry));
        await this.redisClient.sadd(members, userId);
        this.logger.log(`User ${userId} joined ${mode} queue`);
    }
    async cancelSearch(userId) {
        await Promise.all([
            this.redisClient.srem(this.QUEUES.ranked.members, userId),
            this.redisClient.srem(this.QUEUES.unrated.members, userId),
        ]);
        this.logger.log(`User ${userId} removed from all queues`);
    }
    async popValidPlayer(list, members) {
        const MAX_ATTEMPTS = 50;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            const entryStr = await this.redisClient.rpop(list);
            if (!entryStr)
                return null;
            const entry = JSON.parse(entryStr);
            const isMember = await this.redisClient.sismember(members, entry.userId);
            if (isMember) {
                await this.redisClient.srem(members, entry.userId);
                return entry;
            }
        }
        return null;
    }
    async createPrivateRoom(userId, socketId, username) {
        await this.cancelSearch(userId);
        let roomCode = '';
        let isUnique = false;
        while (!isUnique) {
            roomCode = (0, crypto_1.randomBytes)(4).toString('hex').toUpperCase().slice(0, 6);
            const exists = await this.redisClient.exists(`private_room:${roomCode}`);
            if (!exists)
                isUnique = true;
        }
        const TTL = 900;
        const roomData = JSON.stringify({ userId, socketId, username });
        await Promise.all([
            this.redisClient.set(`private_room:${roomCode}`, roomData, 'EX', TTL),
            this.redisClient.set(`user_room:${userId}`, roomCode, 'EX', TTL),
        ]);
        this.logger.log(`Private room ${roomCode} created by user ${userId}`);
        return roomCode;
    }
    async cancelPrivateRoom(userId) {
        const cleanedRoomCode = await this.cleanupUserPrivateRoom(userId);
        if (cleanedRoomCode) {
            this.logger.log(`Private room ${cleanedRoomCode} cancelled by user ${userId}`);
        }
    }
    async cleanupUserPrivateRoom(userId) {
        const userRoomKey = `user_room:${userId}`;
        const roomCode = await this.redisClient.get(userRoomKey);
        if (!roomCode)
            return null;
        const privateRoomKey = `private_room:${roomCode}`;
        const multi = this.redisClient.multi();
        multi.del(privateRoomKey);
        multi.del(userRoomKey);
        await multi.exec();
        return roomCode;
    }
    async joinPrivateRoom(code, userId, socketId, username) {
        const uppercaseCode = code.toUpperCase();
        const privateRoomKey = `private_room:${uppercaseCode}`;
        await this.redisClient.watch(privateRoomKey);
        const roomDataStr = await this.redisClient.get(privateRoomKey);
        if (!roomDataStr) {
            await this.redisClient.unwatch();
            return { success: false, error: 'Room not found or expired' };
        }
        const host = JSON.parse(roomDataStr);
        if (host.userId === userId) {
            await this.redisClient.unwatch();
            return { success: false, error: 'You cannot join your own room' };
        }
        const multi = this.redisClient.multi();
        multi.del(privateRoomKey);
        multi.del(`user_room:${host.userId}`);
        const consumed = await multi.exec();
        if (!consumed) {
            await this.redisClient.unwatch();
            return { success: false, error: 'Room not found or expired' };
        }
        await this.redisClient.unwatch().catch(() => { });
        await Promise.all([
            this.cancelSearch(host.userId),
            this.cancelSearch(userId),
        ]);
        const gameSessionId = (0, crypto_1.randomUUID)();
        const gameState = await this.initializeGameState(gameSessionId, host.userId, userId, host.username, username, false);
        if (this.server) {
            this.server.in([host.socketId, socketId]).socketsJoin(gameSessionId);
            this.server.to(host.socketId).emit('matchFound', { gameSessionId });
            this.server.to(socketId).emit('matchFound', { gameSessionId });
            this.server
                .to(gameSessionId)
                .emit('gameStateUpdated', { state: gameState });
            this.startTurnTimerFn?.(gameSessionId);
        }
        this.logger.log(`Private match created: ${gameSessionId} [${host.userId} vs ${userId}]`);
        return { success: true, gameSessionId };
    }
    async handleMatchmakingInterval() {
        if (!this.server)
            return;
        await Promise.all([
            this.processQueue('ranked', true),
            this.processQueue('unrated', false),
        ]);
    }
    async processQueue(mode, isRanked) {
        const { list, members } = this.QUEUES[mode];
        const queueLength = await this.redisClient.llen(list);
        if (queueLength < 2)
            return;
        const p1 = await this.popValidPlayer(list, members);
        if (!p1)
            return;
        const p2 = await this.popValidPlayer(list, members);
        if (!p2) {
            await this.redisClient.lpush(list, JSON.stringify(p1));
            await this.redisClient.sadd(members, p1.userId);
            return;
        }
        if (p1.userId === p2.userId) {
            await this.redisClient.lpush(list, JSON.stringify(p2));
            await this.redisClient.sadd(members, p2.userId);
            return;
        }
        await Promise.all([
            this.cleanupUserPrivateRoom(p1.userId),
            this.cleanupUserPrivateRoom(p2.userId),
        ]);
        const gameSessionId = (0, crypto_1.randomUUID)();
        const gameState = await this.initializeGameState(gameSessionId, p1.userId, p2.userId, p1.username, p2.username, isRanked);
        this.server.in([p1.socketId, p2.socketId]).socketsJoin(gameSessionId);
        this.server.to(p1.socketId).emit('matchFound', { gameSessionId });
        this.server.to(p2.socketId).emit('matchFound', { gameSessionId });
        this.server
            .to(gameSessionId)
            .emit('gameStateUpdated', { state: gameState });
        this.startTurnTimerFn?.(gameSessionId);
        this.logger.log(`${isRanked ? 'Ranked' : 'Unrated'} match created: ${gameSessionId} ` +
            `[${p1.userId} vs ${p2.userId}]`);
    }
    async initializeGameState(gameSessionId, player1Id, player2Id, player1Username, player2Username, isRanked = false) {
        const [p1Result, p2Result] = await Promise.allSettled([
            this.prisma.user.findUnique({
                where: { id: player1Id },
                select: { mmr: true },
            }),
            this.prisma.user.findUnique({
                where: { id: player2Id },
                select: { mmr: true },
            }),
        ]);
        const p1Mmr = p1Result.status === 'fulfilled' ? (p1Result.value?.mmr ?? 1000) : 1000;
        const p2Mmr = p2Result.status === 'fulfilled' ? (p2Result.value?.mmr ?? 1000) : 1000;
        const gameState = {
            players: [player1Id, player2Id],
            currentTurn: player1Id,
            playerNames: {
                [player1Id]: player1Username ?? String(player1Id),
                [player2Id]: player2Username ?? String(player2Id),
            },
            playerMmr: {
                [player1Id]: p1Mmr,
                [player2Id]: p2Mmr,
            },
            roundHistory: [],
            scores: { [player1Id]: 0, [player2Id]: 0 },
            overallScores: { [player1Id]: 0, [player2Id]: 0 },
            currentRound: 1,
            strikes: { [player1Id]: 0, [player2Id]: 0 },
            guessedPlayers: [],
            currentQuestion: (0, game_questions_1.pickRandomFootballQuestion)(),
            isRanked,
        };
        const gameKey = `game:${gameSessionId}`;
        const stateJson = JSON.stringify(gameState);
        const multi = this.redisClient.multi();
        multi.set(gameKey, stateJson);
        multi.set(`active_game:${player1Id}`, gameSessionId);
        multi.set(`active_game:${player2Id}`, gameSessionId);
        await multi.exec();
        return gameState;
    }
    deleteActiveGameKeysInMulti(multi, playerIds) {
        for (const raw of playerIds) {
            if (raw === undefined || raw === null)
                continue;
            const id = String(raw);
            if (!id)
                continue;
            multi.del(`active_game:${id}`);
        }
    }
    async getActiveGameSessionIdForUser(userId) {
        const uid = String(userId);
        const key = `active_game:${uid}`;
        const sessionId = await this.redisClient.get(key);
        if (!sessionId)
            return null;
        const gameKey = `game:${sessionId}`;
        const stateStr = await this.redisClient.get(gameKey);
        if (!stateStr) {
            await this.redisClient.del(key).catch(() => { });
            return null;
        }
        let state;
        try {
            state = JSON.parse(stateStr);
        }
        catch {
            await this.redisClient.del(key).catch(() => { });
            return null;
        }
        if (state.status === 'match_completed') {
            const players = (state.players ?? []).map((p) => String(p));
            const m = this.redisClient.multi();
            this.deleteActiveGameKeysInMulti(m, players);
            await m.exec().catch(() => { });
            return null;
        }
        const players = (state.players ?? []).map((p) => String(p));
        if (!players.includes(uid)) {
            await this.redisClient.del(key).catch(() => { });
            return null;
        }
        return sessionId;
    }
    async updateMmrAfterMatch(winnerId, loserId, options) {
        try {
            const [winner, loser] = await Promise.all([
                this.prisma.user.findUnique({
                    where: { id: winnerId },
                    select: { mmr: true },
                }),
                this.prisma.user.findUnique({
                    where: { id: loserId },
                    select: { mmr: true },
                }),
            ]);
            if (!winner || !loser) {
                this.logger.warn(`MMR update skipped — winner=${winnerId} found=${!!winner}, loser=${loserId} found=${!!loser}`);
                return null;
            }
            const margin = options?.marginMultiplier ?? 1;
            const { winnerNewMmr, loserNewMmr, winnerDelta, loserDelta } = (0, elo_util_1.calculateElo)(winner.mmr, loser.mmr, 32, margin);
            await Promise.all([
                this.prisma.user.update({
                    where: { id: winnerId },
                    data: {
                        mmr: winnerNewMmr,
                        wins: { increment: 1 },
                        gamesPlayed: { increment: 1 },
                    },
                }),
                this.prisma.user.update({
                    where: { id: loserId },
                    data: {
                        mmr: loserNewMmr,
                        gamesPlayed: { increment: 1 },
                    },
                }),
            ]);
            this.logger.log(`MMR updated — winner ${winnerId}: ${winner.mmr} → ${winnerNewMmr} (+${winnerDelta}), ` +
                `loser ${loserId}: ${loser.mmr} → ${loserNewMmr} (${loserDelta})`);
            return { winnerDelta, loserDelta };
        }
        catch (error) {
            const err = error;
            this.logger.error(`MMR update failed: ${err?.message}`, err?.stack);
            return null;
        }
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
    __metadata("design:paramtypes", [redis_service_1.RedisService,
        prisma_service_1.PrismaService])
], MatchmakingService);
//# sourceMappingURL=matchmaking.service.js.map