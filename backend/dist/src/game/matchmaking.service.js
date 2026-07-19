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
const elo_util_1 = require("./elo.util");
const game_service_1 = require("./game.service");
let MatchmakingService = MatchmakingService_1 = class MatchmakingService {
    redisClient;
    prisma;
    gameService;
    logger = new common_1.Logger(MatchmakingService_1.name);
    server;
    startTurnTimerFn;
    roomExpiryTimers = new Map();
    SEARCH_TTL_SECONDS = 60;
    PRIVATE_ROOM_TTL_SECONDS = 60;
    ACTIVE_GAME_KEY_PREFIX = 'user_active_game:';
    QUEUES = {
        ranked: { zset: 'ranked_queue', members: 'ranked_queue_members' },
        unrated: { zset: 'unrated_queue', members: 'unrated_queue_members' },
    };
    constructor(redisClient, prisma, gameService) {
        this.redisClient = redisClient;
        this.prisma = prisma;
        this.gameService = gameService;
    }
    setServer(server) {
        this.server = server;
    }
    setTurnTimerStarter(fn) {
        this.startTurnTimerFn = fn;
    }
    queueSearchKey(userId) {
        return `queue_search:${userId}`;
    }
    activeGameKey(userId) {
        return `${this.ACTIVE_GAME_KEY_PREFIX}${userId}`;
    }
    clearRoomExpiryTimer(userId) {
        const timer = this.roomExpiryTimers.get(userId);
        if (!timer)
            return;
        clearTimeout(timer);
        this.roomExpiryTimers.delete(userId);
    }
    schedulePrivateRoomExpiry(userId, roomCode) {
        this.clearRoomExpiryTimer(userId);
        const timeout = setTimeout(async () => {
            this.roomExpiryTimers.delete(userId);
            const userRoomKey = `user_room:${userId}`;
            const privateRoomKey = `private_room:${roomCode}`;
            const currentRoomCode = await this.redisClient.get(userRoomKey);
            if (currentRoomCode !== roomCode)
                return;
            const roomExists = await this.redisClient
                .exists(privateRoomKey)
                .catch(() => 0);
            if (!roomExists)
                return;
            const multi = this.redisClient.multi();
            multi.del(privateRoomKey);
            multi.del(userRoomKey);
            await multi.exec();
            this.server?.to(userId).emit('roomExpired', { roomCode });
        }, this.PRIVATE_ROOM_TTL_SECONDS * 1000);
        this.roomExpiryTimers.set(userId, timeout);
    }
    async joinQueue(userId, socketId, username, mode) {
        const { zset, members } = this.QUEUES[mode];
        const opposite = mode === 'ranked' ? 'unrated' : 'ranked';
        await this.removeUserFromQueue(opposite, userId);
        await this.cleanupUserPrivateRoom(userId);
        await Promise.all([
            this.redisClient.zrem(zset, userId),
            this.redisClient.srem(members, userId),
        ]);
        const createdAtMs = Date.now();
        const entry = { userId, socketId, username };
        await Promise.all([
            this.redisClient.zadd(zset, createdAtMs, userId),
            this.redisClient.sadd(members, userId),
            this.redisClient.set(this.queueSearchKey(userId), JSON.stringify({
                mode,
                userId,
                socketId,
                username,
                createdAtMs,
            }), 'EX', this.SEARCH_TTL_SECONDS),
        ]);
        this.logger.log(`User ${userId} joined ${mode} queue`);
    }
    async cancelSearch(userId) {
        await Promise.all([
            this.removeUserFromQueue('ranked', userId),
            this.removeUserFromQueue('unrated', userId),
            this.redisClient.del(this.queueSearchKey(userId)),
        ]);
        this.logger.log(`User ${userId} removed from all queues`);
    }
    async removeUserFromQueue(mode, userId) {
        const { zset, members } = this.QUEUES[mode];
        await Promise.all([
            this.redisClient.zrem(zset, userId),
            this.redisClient.srem(members, userId),
        ]);
    }
    async purgeExpiredUsers(mode) {
        const { zset, members } = this.QUEUES[mode];
        const cutoff = Date.now() - this.SEARCH_TTL_SECONDS * 1000;
        const expiredUserIds = await this.redisClient.zrangebyscore(zset, '-inf', cutoff);
        if (!expiredUserIds.length)
            return;
        expiredUserIds.forEach((userId) => {
            this.server?.to(userId).emit('searchExpired', { mode });
        });
        const keys = expiredUserIds.map((id) => this.queueSearchKey(id));
        await this.redisClient.zremrangebyscore(zset, '-inf', cutoff);
        const multi = this.redisClient.multi();
        if (expiredUserIds.length > 0) {
            multi.srem(members, ...expiredUserIds);
            multi.del(...keys);
        }
        await multi.exec();
    }
    async popValidPlayerPair(zset, members) {
        const script = `
local queueKey = KEYS[1]
local membersKey = KEYS[2]
local entries = redis.call('ZRANGE', queueKey, 0, 99)
local selected = {}

for _, userId in ipairs(entries) do
  local isMember = redis.call('SISMEMBER', membersKey, userId)
  if isMember == 1 then
    local raw = redis.call('GET', 'queue_search:' .. userId)
    if raw then
      table.insert(selected, raw)
      if #selected == 2 then
        break
      end
    else
      redis.call('SREM', membersKey, userId)
      redis.call('ZREM', queueKey, userId)
    end
  else
    redis.call('ZREM', queueKey, userId)
  end
end

if #selected < 2 then
  return {}
end

for _, raw in ipairs(selected) do
  local data = cjson.decode(raw)
  local userId = tostring(data.userId)
  redis.call('ZREM', queueKey, userId)
  redis.call('SREM', membersKey, userId)
  redis.call('DEL', 'queue_search:' .. userId)
end

return selected
`;
        const result = await this.redisClient.eval(script, 2, zset, members);
        if (!Array.isArray(result) || result.length < 2) {
            return null;
        }
        try {
            const p1 = JSON.parse(String(result[0]));
            const p2 = JSON.parse(String(result[1]));
            if (!p1?.userId || !p2?.userId || p1.userId === p2.userId) {
                return null;
            }
            return [p1, p2];
        }
        catch {
            return null;
        }
    }
    async createPrivateRoom(userId, socketId, username, config) {
        let finalConfig = config;
        if (finalConfig) {
            if (!Array.isArray(finalConfig.composition) || finalConfig.composition.length === 0) {
                throw new Error('Composition must have at least 1 entry');
            }
            const validModes = ['STRIKES', 'TOP_10', 'PHOTO_GUESS', 'LINEUP'];
            for (const mode of finalConfig.composition) {
                if (!validModes.includes(mode)) {
                    throw new Error('Invalid game mode in composition');
                }
            }
            const validTimers = [10000, 15000, 30000, 60000];
            for (const val of Object.values(finalConfig.timerConfig || {})) {
                if (!validTimers.includes(val)) {
                    throw new Error('Invalid timer config value');
                }
            }
        }
        else {
            finalConfig = {
                composition: ['STRIKES', 'STRIKES', 'TOP_10'],
                timerConfig: { STRIKES: 10000, TOP_10: 10000 },
            };
        }
        await this.cancelSearch(userId);
        let roomCode = '';
        let isUnique = false;
        while (!isUnique) {
            roomCode = (0, crypto_1.randomBytes)(4).toString('hex').toUpperCase().slice(0, 6);
            const exists = await this.redisClient.exists(`private_room:${roomCode}`);
            if (!exists)
                isUnique = true;
        }
        const TTL = this.PRIVATE_ROOM_TTL_SECONDS;
        const roomData = JSON.stringify({ userId, socketId, username, config: finalConfig });
        await Promise.all([
            this.redisClient.set(`private_room:${roomCode}`, roomData, 'EX', TTL),
            this.redisClient.set(`user_room:${userId}`, roomCode, 'EX', TTL),
        ]);
        this.schedulePrivateRoomExpiry(userId, roomCode);
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
        if (!roomCode) {
            this.clearRoomExpiryTimer(userId);
            return null;
        }
        const privateRoomKey = `private_room:${roomCode}`;
        const multi = this.redisClient.multi();
        multi.del(privateRoomKey);
        multi.del(userRoomKey);
        await multi.exec();
        this.clearRoomExpiryTimer(userId);
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
        this.clearRoomExpiryTimer(host.userId);
        await Promise.all([
            this.cancelSearch(host.userId),
            this.cancelSearch(userId),
        ]);
        const gameSessionId = (0, crypto_1.randomUUID)();
        const gameState = await this.initializeGameState(gameSessionId, host.userId, userId, host.username, username, false, host.config?.composition, host.config?.timerConfig);
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
        const { zset, members } = this.QUEUES[mode];
        await this.purgeExpiredUsers(mode);
        const queueLength = await this.redisClient.zcard(zset);
        if (queueLength < 2)
            return;
        const pair = await this.popValidPlayerPair(zset, members);
        if (!pair)
            return;
        const [p1, p2] = pair;
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
    async initializeGameState(gameSessionId, player1Id, player2Id, player1Username, player2Username, isRanked = false, composition = ['STRIKES', 'STRIKES', 'TOP_10'], timerConfig) {
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
            status: 'in_progress',
            winner: null,
            isRanked,
            composition,
            timerConfig: timerConfig || { STRIKES: 10_000, TOP_10: 10_000 },
            mode: composition[0],
            playerNames: {
                [player1Id]: player1Username ?? String(player1Id),
                [player2Id]: player2Username ?? String(player2Id),
            },
            playerMmr: {
                [player1Id]: p1Mmr,
                [player2Id]: p2Mmr,
            },
            modeState: {
                currentRound: 1,
                roundWinnerId: null,
                overallScores: { [player1Id]: 0, [player2Id]: 0 },
                roundHistory: [],
                usedQuestionIds: [],
                currentQuestion: null,
            },
        };
        const modeClass = gameState.mode === 'TOP_10'
            ? require('./top10-mode.strategy').Top10ModeStrategy
            : require('./strikes-mode.strategy').StrikesModeStrategy;
        const strategy = new modeClass();
        strategy.initializeRoundState(gameState);
        const firstQuestion = await this.gameService.getRandomQuestion(gameState.mode);
        gameState.modeState.currentQuestion = firstQuestion;
        if (firstQuestion) {
            gameState.modeState.usedQuestionIds.push(firstQuestion.id);
        }
        const gameKey = `game:${gameSessionId}`;
        const stateJson = JSON.stringify(gameState);
        const multi = this.redisClient.multi();
        multi.set(gameKey, stateJson);
        this.setActiveGameSessionIdInMulti(multi, player1Id, gameSessionId);
        this.setActiveGameSessionIdInMulti(multi, player2Id, gameSessionId);
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
            multi.del(this.activeGameKey(id));
            multi.del(`active_game:${id}`);
        }
    }
    setActiveGameSessionIdInMulti(multi, userId, gameSessionId) {
        const key = this.activeGameKey(String(userId));
        multi.set(key, String(gameSessionId));
        multi.expire(key, 6 * 60 * 60);
    }
    async setActiveGameSessionIdForUser(userId, gameSessionId) {
        await this.redisClient.set(this.activeGameKey(String(userId)), String(gameSessionId), 'EX', 6 * 60 * 60);
    }
    async getActiveGameSessionIdForUser(userId) {
        const uid = String(userId);
        const key = this.activeGameKey(uid);
        let sessionId = await this.redisClient.get(key);
        if (!sessionId) {
            const legacyKey = `active_game:${uid}`;
            const legacySessionId = await this.redisClient.get(legacyKey);
            if (!legacySessionId)
                return null;
            sessionId = legacySessionId;
            const multi = this.redisClient.multi();
            multi.set(key, sessionId);
            multi.del(legacyKey);
            await multi.exec().catch(() => { });
        }
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
    async updateMmrAfterDraw(playerAId, playerBId) {
        try {
            const [playerA, playerB] = await Promise.all([
                this.prisma.user.findUnique({
                    where: { id: playerAId },
                    select: { mmr: true },
                }),
                this.prisma.user.findUnique({
                    where: { id: playerBId },
                    select: { mmr: true },
                }),
            ]);
            if (!playerA || !playerB) {
                this.logger.warn(`MMR draw update skipped — playerA=${playerAId} found=${!!playerA}, playerB=${playerBId} found=${!!playerB}`);
                return null;
            }
            const { newMmrA, newMmrB, deltaA, deltaB } = (0, elo_util_1.calculateEloDraw)(playerA.mmr, playerB.mmr, 32);
            await Promise.all([
                this.prisma.user.update({
                    where: { id: playerAId },
                    data: {
                        mmr: newMmrA,
                        gamesPlayed: { increment: 1 },
                    },
                }),
                this.prisma.user.update({
                    where: { id: playerBId },
                    data: {
                        mmr: newMmrB,
                        gamesPlayed: { increment: 1 },
                    },
                }),
            ]);
            this.logger.log(`MMR updated (draw) — playerA ${playerAId}: ${playerA.mmr} → ${newMmrA} (${deltaA > 0 ? '+' : ''}${deltaA}), ` +
                `playerB ${playerBId}: ${playerB.mmr} → ${newMmrB} (${deltaB > 0 ? '+' : ''}${deltaB})`);
            return { deltaA, deltaB };
        }
        catch (error) {
            const err = error;
            this.logger.error(`MMR draw update failed: ${err?.message}`, err?.stack);
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
        prisma_service_1.PrismaService,
        game_service_1.GameService])
], MatchmakingService);
//# sourceMappingURL=matchmaking.service.js.map