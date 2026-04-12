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
var GameGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const schedule_1 = require("@nestjs/schedule");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const matchmaking_service_1 = require("./matchmaking.service");
const game_service_1 = require("./game.service");
const redis_service_1 = require("../redis/redis.service");
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const game_questions_1 = require("./game.questions");
const elo_util_1 = require("./elo.util");
const friends_service_1 = require("../friends/friends.service");
const GUESS_RATE_LIMIT_MAX = 5;
const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
let GameGateway = GameGateway_1 = class GameGateway {
    jwtService;
    matchmakingService;
    gameService;
    redisClient;
    friendsService;
    server;
    logger = new common_1.Logger(GameGateway_1.name);
    turnTimers = new Map();
    rematchTimers = new Map();
    disconnectTimers = new Map();
    guessTimestamps = new Map();
    roundTransitionMs = 4000;
    DISCONNECT_GRACE_MS = 15_000;
    constructor(jwtService, matchmakingService, gameService, redisClient, friendsService) {
        this.jwtService = jwtService;
        this.matchmakingService = matchmakingService;
        this.gameService = gameService;
        this.redisClient = redisClient;
        this.friendsService = friendsService;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    async setPresenceOnline(userId) {
        await this.redisClient.hset('presence', userId, 'online');
    }
    async setPresenceInGame(userId, gameSessionId) {
        await this.redisClient.hset('presence', userId, `in-game:${gameSessionId}`);
    }
    async clearPresence(userId) {
        await this.redisClient.hdel('presence', userId);
    }
    async emitFriendsPresenceSnapshot(userId) {
        if (!this.server)
            return;
        const friends = await this.friendsService.getFriendPresenceSnapshot(userId);
        this.server.to(userId).emit('friendsPresenceUpdated', { friends });
    }
    async broadcastFriendPresences() {
        if (!this.server)
            return;
        const userIds = await this.redisClient.hkeys('presence').catch(() => []);
        if (!userIds.length)
            return;
        await Promise.all(userIds.map(async (userId) => {
            try {
                const friends = await this.friendsService.getFriendPresenceSnapshot(userId);
                this.server.to(userId).emit('friendsPresenceUpdated', { friends });
            }
            catch (error) {
                this.logger.warn(`Presence broadcast skipped for ${userId}: ${error?.message}`);
            }
        }));
    }
    async resolveMmrDeltasForMatch(state, winnerId, loserId, forfeited) {
        if (!state?.isRanked || !winnerId || !loserId)
            return undefined;
        const w = Number(state.overallScores?.[winnerId] ?? 0);
        const l = Number(state.overallScores?.[loserId] ?? 0);
        const margin = forfeited ? 1.2 : (0, elo_util_1.scoreMarginMultiplier)(w, l);
        const res = await this.matchmakingService.updateMmrAfterMatch(winnerId, loserId, {
            marginMultiplier: margin,
        });
        if (!res)
            return undefined;
        return { [winnerId]: res.winnerDelta, [loserId]: res.loserDelta };
    }
    afterInit(server) {
        this.matchmakingService.setServer(server);
        this.matchmakingService.setTurnTimerStarter(this.startTurnTimer.bind(this));
    }
    isGuestRateLimited(userId) {
        const now = Date.now();
        const recent = (this.guessTimestamps.get(userId) ?? []).filter((t) => now - t < GUESS_RATE_LIMIT_WINDOW_MS);
        if (recent.length >= GUESS_RATE_LIMIT_MAX) {
            this.guessTimestamps.set(userId, recent);
            return true;
        }
        recent.push(now);
        this.guessTimestamps.set(userId, recent);
        return false;
    }
    clearTurnTimer(gameSessionId) {
        const existing = this.turnTimers.get(gameSessionId);
        if (existing) {
            clearTimeout(existing);
            this.turnTimers.delete(gameSessionId);
        }
    }
    async initializeRematch(gameSessionId, state) {
        const p1Id = String(state.players[0]);
        const p2Id = String(state.players[1]);
        const names = (state.playerNames ?? {});
        const p1Name = names[p1Id] ?? p1Id;
        const p2Name = names[p2Id] ?? p2Id;
        const rematchData = JSON.stringify({
            p1Id,
            p2Id,
            p1Name,
            p2Name,
            p1Ready: false,
            p2Ready: false,
            isRanked: !!state.isRanked,
        });
        await this.redisClient.set(`rematch:${gameSessionId}`, rematchData, 'EX', 35);
        this.startRematchTimer(gameSessionId);
        this.logger.log(`Rematch window opened for game ${gameSessionId}`);
    }
    startRematchTimer(gameSessionId) {
        this.clearRematchTimer(gameSessionId);
        const timeout = setTimeout(async () => {
            this.rematchTimers.delete(gameSessionId);
            await this.redisClient.del(`rematch:${gameSessionId}`).catch(() => { });
            this.server.to(gameSessionId).emit('rematchExpired');
            this.logger.log(`Rematch window expired for game ${gameSessionId}`);
        }, 30_000);
        this.rematchTimers.set(gameSessionId, timeout);
    }
    clearRematchTimer(gameSessionId) {
        const existing = this.rematchTimers.get(gameSessionId);
        if (existing) {
            clearTimeout(existing);
            this.rematchTimers.delete(gameSessionId);
        }
    }
    disconnectTimerKey(gameSessionId, userId) {
        return `${gameSessionId}:${userId}`;
    }
    startDisconnectTimer(gameSessionId, userId) {
        const key = this.disconnectTimerKey(gameSessionId, userId);
        this.clearDisconnectTimer(gameSessionId, userId);
        const timer = setTimeout(async () => {
            this.disconnectTimers.delete(key);
            this.logger.log(`Disconnect grace period expired for user ${userId} in game ${gameSessionId} — forfeiting`);
            const gameKey = `game:${gameSessionId}`;
            try {
                await this.redisClient.watch(gameKey);
                const stateStr = await this.redisClient.get(gameKey);
                if (!stateStr) {
                    await this.redisClient.unwatch();
                    return;
                }
                const state = JSON.parse(stateStr);
                if (state.status === 'match_completed') {
                    await this.redisClient.unwatch();
                    return;
                }
                const winnerId = state.players.find((p) => p !== userId);
                state.status = 'match_completed';
                state.winner = winnerId;
                if (!Array.isArray(state.roundHistory))
                    state.roundHistory = [];
                if (!state.roundHistory.some((r) => r?.round === state.currentRound)) {
                    state.roundHistory.push({
                        round: state.currentRound,
                        winner: winnerId,
                        scores: { ...(state.scores ?? {}) },
                    });
                }
                const multi = this.redisClient.multi();
                multi.set(gameKey, JSON.stringify(state));
                this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
                const results = await multi.exec();
                if (!results) {
                    await this.redisClient.unwatch().catch(() => { });
                    return;
                }
                this.clearTurnTimer(gameSessionId);
                const mmrDeltas = await this.resolveMmrDeltasForMatch(state, winnerId, userId, true);
                const payload = {
                    state,
                    forfeit: true,
                    disconnectedUserId: userId,
                    forfeitedByUserId: userId,
                    mmrDeltas,
                };
                this.server.to(gameSessionId).emit('matchOver', payload);
                this.initializeRematch(gameSessionId, state).catch((e) => this.logger.error(`initializeRematch (forfeit) failed: ${e?.message}`));
            }
            catch (error) {
                this.logger.error(`Error in disconnect forfeit handler: ${error?.message}`, error?.stack);
            }
            finally {
                await this.redisClient.unwatch().catch(() => { });
            }
        }, this.DISCONNECT_GRACE_MS);
        this.disconnectTimers.set(key, timer);
    }
    clearDisconnectTimer(gameSessionId, userId) {
        const key = this.disconnectTimerKey(gameSessionId, userId);
        const existing = this.disconnectTimers.get(key);
        if (existing) {
            clearTimeout(existing);
            this.disconnectTimers.delete(key);
        }
    }
    startTurnTimer(gameSessionId) {
        this.clearTurnTimer(gameSessionId);
        const timeout = setTimeout(async () => {
            this.turnTimers.delete(gameSessionId);
            const key = `game:${gameSessionId}`;
            try {
                await this.redisClient.watch(key);
                const stateStr = await this.redisClient.get(key);
                if (!stateStr) {
                    await this.redisClient.unwatch();
                    return;
                }
                const state = JSON.parse(stateStr);
                if (state.status === 'match_completed') {
                    await this.redisClient.unwatch();
                    return;
                }
                const timedOutUserId = state.currentTurn;
                if (!timedOutUserId) {
                    await this.redisClient.unwatch();
                    return;
                }
                state.strikes[timedOutUserId] = (state.strikes[timedOutUserId] ?? 0) + 1;
                let isRoundOver = false;
                let isMatchOver = false;
                let roundWinner = null;
                if (state.strikes[timedOutUserId] >= 3) {
                    isRoundOver = true;
                    const otherPlayer = state.players.find((p) => p !== timedOutUserId) ||
                        state.players[0];
                    roundWinner = otherPlayer;
                    if (!Array.isArray(state.roundHistory))
                        state.roundHistory = [];
                    if (!state.roundHistory.some((r) => r?.round === state.currentRound)) {
                        state.roundHistory.push({
                            round: state.currentRound,
                            winner: roundWinner,
                            scores: { ...(state.scores ?? {}) },
                        });
                    }
                    state.overallScores[otherPlayer] += 1;
                    if (state.overallScores[otherPlayer] >= 2 ||
                        state.currentRound >= 3) {
                        isMatchOver = true;
                        state.status = 'match_completed';
                        state.winner =
                            state.overallScores[state.players[0]] >
                                state.overallScores[state.players[1]]
                                ? state.players[0]
                                : state.players[1];
                    }
                    else {
                        state.currentTurn = null;
                    }
                }
                else {
                    const otherPlayer = state.players.find((p) => p !== timedOutUserId) ||
                        state.players[0];
                    state.currentTurn = otherPlayer;
                }
                const multi = this.redisClient.multi();
                multi.set(key, JSON.stringify(state));
                if (isMatchOver) {
                    this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
                }
                const results = await multi.exec();
                if (!results) {
                    this.startTurnTimer(gameSessionId);
                    return;
                }
                const updatePayload = {
                    state,
                    lastGuess: {
                        user: timedOutUserId,
                        guess: null,
                        correct: false,
                        matchedName: null,
                        reason: 'timeout',
                    },
                };
                this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
                if (isMatchOver) {
                    this.clearTurnTimer(gameSessionId);
                    const loserId = state.players.find((p) => p !== state.winner);
                    const mmrDeltas = await this.resolveMmrDeltasForMatch(state, state.winner, loserId, false);
                    this.server.to(gameSessionId).emit('matchOver', {
                        ...updatePayload,
                        forfeit: false,
                        mmrDeltas,
                    });
                    this.initializeRematch(gameSessionId, state).catch((e) => this.logger.error(`initializeRematch failed: ${e?.message}`));
                }
                else if (isRoundOver) {
                    this.server.to(gameSessionId).emit('roundOver', {
                        winner: roundWinner,
                        nextRoundIn: this.roundTransitionMs / 1000,
                    });
                    await this.sleep(this.roundTransitionMs);
                    await this.redisClient.watch(key);
                    const latestStr = await this.redisClient.get(key);
                    if (!latestStr) {
                        await this.redisClient.unwatch();
                        return;
                    }
                    const latest = JSON.parse(latestStr);
                    if (latest.status === 'match_completed') {
                        await this.redisClient.unwatch();
                        return;
                    }
                    latest.currentRound += 1;
                    latest.scores = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
                    latest.strikes = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
                    latest.guessedPlayers = [];
                    latest.currentQuestion = (0, game_questions_1.pickRandomFootballQuestion)();
                    if (latest.currentRound === 2)
                        latest.currentTurn = latest.players[1];
                    else if (latest.currentRound === 3)
                        latest.currentTurn = latest.players[0];
                    else
                        latest.currentTurn = latest.players[0];
                    const multi2 = this.redisClient.multi();
                    multi2.set(key, JSON.stringify(latest));
                    const results2 = await multi2.exec();
                    if (!results2) {
                        this.startTurnTimer(gameSessionId);
                        return;
                    }
                    const nextPayload = { state: latest, lastGuess: updatePayload.lastGuess };
                    this.server.to(gameSessionId).emit('nextRoundStarted', nextPayload);
                    this.startTurnTimer(gameSessionId);
                }
                else {
                    this.startTurnTimer(gameSessionId);
                }
            }
            catch (error) {
                this.logger.error(`Exception in turn timer for ${gameSessionId}: ${error.message}`, error.stack);
            }
            finally {
                await this.redisClient.unwatch().catch(() => { });
            }
        }, 10_000);
        this.turnTimers.set(gameSessionId, timeout);
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                this.logger.log(`Connection rejected: Missing token for client ${client.id}`);
                client.disconnect();
                return;
            }
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
            });
            client.data.user = payload;
            const userId = String(payload.sub || payload.userId || '');
            if (userId) {
                await client.join(userId);
                await this.setPresenceOnline(userId);
                this.emitFriendsPresenceSnapshot(userId).catch(() => { });
            }
            this.logger.log(`Client connected: ${client.id} (User ID: ${payload.sub || payload.userId})`);
        }
        catch {
            this.logger.log(`Connection rejected: Invalid token for client ${client.id}`);
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
        const userId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (userId) {
            this.matchmakingService.cancelSearch(userId).catch(() => { });
            this.matchmakingService.cancelPrivateRoom(userId).catch(() => { });
        }
        try {
            const rooms = Array.from(client.rooms ?? []);
            for (const room of rooms) {
                if (!room || room === client.id)
                    continue;
                const stateExists = await this.redisClient.exists(`game:${room}`).catch(() => 0);
                if (!stateExists)
                    continue;
                let endedMatch = false;
                try {
                    const stateStr = await this.redisClient.get(`game:${room}`);
                    if (stateStr) {
                        const parsed = JSON.parse(stateStr);
                        endedMatch = parsed?.status === 'match_completed';
                    }
                }
                catch {
                }
                if (endedMatch && userId) {
                    this.server.to(room).emit('opponentLeft', { userId, gameSessionId: room });
                    this.logger.log(`User ${userId} left ended game ${room} — opponentLeft emitted`);
                    continue;
                }
                if (userId) {
                    this.startDisconnectTimer(room, userId);
                    this.server.to(room).emit('playerDisconnected', { userId, gameSessionId: room });
                    this.logger.log(`User ${userId} disconnected from game ${room} — grace period started`);
                }
            }
        }
        catch (e) {
            this.logger.error(`Error in handleDisconnect cleanup: ${e?.message}`);
        }
        if (userId) {
            await this.clearPresence(userId).catch(() => { });
        }
    }
    async handleJoinQueue(client, mode = 'ranked') {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        const resolvedMode = mode === 'ranked' || mode === 'unrated' ? mode : 'ranked';
        const username = client.data?.user?.username ||
            client.data?.user?.name ||
            client.data?.user?.email;
        await this.matchmakingService.joinQueue(userId, client.id, username, resolvedMode);
        return { status: 'queued', mode: resolvedMode };
    }
    async handleCancelSearch(client) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        await this.matchmakingService.cancelSearch(userId);
        return { status: 'ok' };
    }
    async handleCancelPrivateRoom(client) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        await this.matchmakingService.cancelPrivateRoom(userId);
        return { status: 'ok' };
    }
    async handleCreatePrivateRoom(client) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        const username = client.data?.user?.username ||
            client.data?.user?.name ||
            client.data?.user?.email;
        const roomCode = await this.matchmakingService.createPrivateRoom(userId, client.id, username);
        return { status: 'success', roomCode };
    }
    async handleInviteFriendToGame(client, friendId) {
        const userId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        if (!friendId)
            return { status: 'error', message: 'friendId required' };
        const inviterUsername = client.data?.user?.username ||
            client.data?.user?.name ||
            client.data?.user?.email ||
            userId;
        try {
            await this.friendsService.ensureUsersAreFriends(userId, friendId);
            const roomCode = await this.matchmakingService.createPrivateRoom(userId, client.id, inviterUsername);
            this.server.to(friendId).emit('friendGameInvite', {
                inviterId: userId,
                inviterUsername,
                roomCode,
            });
            return { status: 'success', roomCode };
        }
        catch (error) {
            return {
                status: 'error',
                message: error?.message || 'Failed to invite friend',
            };
        }
    }
    async handleJoinPrivateRoom(client, roomCode) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        if (!roomCode)
            return { status: 'error', message: 'Room code required' };
        const username = client.data?.user?.username ||
            client.data?.user?.name ||
            client.data?.user?.email;
        const result = await this.matchmakingService.joinPrivateRoom(roomCode, userId, client.id, username);
        return result;
    }
    async handleRequestRematch(client, gameSessionId) {
        const userId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!userId || !gameSessionId) {
            return { status: 'error', message: 'Invalid request' };
        }
        const rematchKey = `rematch:${gameSessionId}`;
        try {
            await this.redisClient.watch(rematchKey);
            const rematchStr = await this.redisClient.get(rematchKey);
            if (!rematchStr) {
                await this.redisClient.unwatch();
                return { status: 'error', message: 'Rematch window has expired' };
            }
            const rematch = JSON.parse(rematchStr);
            if (rematch.p1Id === userId) {
                rematch.p1Ready = true;
            }
            else if (rematch.p2Id === userId) {
                rematch.p2Ready = true;
            }
            else {
                await this.redisClient.unwatch();
                return { status: 'error', message: 'Not a player in this game' };
            }
            const multi = this.redisClient.multi();
            multi.set(rematchKey, JSON.stringify(rematch), 'EX', 35);
            const results = await multi.exec();
            if (!results) {
                return { status: 'retry', message: 'Concurrent update, please try again' };
            }
            this.server.to(gameSessionId).emit('rematchRequested', { userId });
            if (rematch.p1Ready && rematch.p2Ready) {
                this.clearRematchTimer(gameSessionId);
                await this.redisClient.del(rematchKey);
                const newGameSessionId = (0, crypto_1.randomUUID)();
                const newState = await this.matchmakingService.initializeGameState(newGameSessionId, rematch.p1Id, rematch.p2Id, rematch.p1Name, rematch.p2Name, rematch.isRanked === true);
                this.server.in(gameSessionId).socketsJoin(newGameSessionId);
                await Promise.all([
                    this.setPresenceInGame(rematch.p1Id, newGameSessionId),
                    this.setPresenceInGame(rematch.p2Id, newGameSessionId),
                ]);
                this.server.to(gameSessionId).emit('rematchStarting', { newGameSessionId });
                this.server.to(newGameSessionId).emit('gameStateUpdated', { state: newState });
                this.startTurnTimer(newGameSessionId);
                this.logger.log(`Rematch started: ${newGameSessionId} (from ${gameSessionId})`);
            }
            return { status: 'ok' };
        }
        catch (error) {
            this.logger.error(`Error in requestRematch: ${error?.message}`, error?.stack);
            return { status: 'error', message: 'Internal server error' };
        }
        finally {
            await this.redisClient.unwatch().catch(() => { });
        }
    }
    async handleLeaveEndedMatch(client, gameSessionId) {
        const userId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!userId || !gameSessionId) {
            return { status: 'error', message: 'Invalid request' };
        }
        try {
            const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
            if (!stateStr) {
                await this.setPresenceOnline(userId).catch(() => { });
                return { status: 'ok' };
            }
            const state = JSON.parse(stateStr);
            if (state?.status !== 'match_completed') {
                return { status: 'error', message: 'Match is not finished' };
            }
            await this.setPresenceOnline(userId);
            client.leave(gameSessionId);
            this.server.to(gameSessionId).emit('opponentLeft', { userId, gameSessionId });
            this.logger.log(`User ${userId} acknowledged leaving ended match ${gameSessionId}`);
            return { status: 'ok' };
        }
        catch (error) {
            this.logger.error(`leaveEndedMatch failed: ${error?.message}`, error?.stack);
            return { status: 'error', message: 'Internal server error' };
        }
    }
    async handleJoinGameRoom(client, gameSessionId) {
        const userId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        if (!gameSessionId)
            return { status: 'error', message: 'gameSessionId required' };
        client.join(gameSessionId);
        this.logger.log(`User ${userId} joined game room ${gameSessionId} (socket ${client.id})`);
        await this.setPresenceInGame(userId, gameSessionId).catch(() => { });
        const hadDisconnectTimer = this.disconnectTimers.has(this.disconnectTimerKey(gameSessionId, userId));
        if (hadDisconnectTimer) {
            this.clearDisconnectTimer(gameSessionId, userId);
            try {
                const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
                if (stateStr) {
                    const state = JSON.parse(stateStr);
                    if (state.status !== 'match_completed') {
                        this.server
                            .to(gameSessionId)
                            .emit('playerReconnected', { userId, gameSessionId });
                        this.startTurnTimer(gameSessionId);
                        this.logger.log(`User ${userId} reconnected to game ${gameSessionId} — timer resumed`);
                    }
                }
            }
            catch (err) {
                this.logger.error(`Error during reconnect timer restore: ${err?.message}`);
            }
        }
        try {
            const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
            if (stateStr) {
                client.emit('gameStateUpdated', { state: JSON.parse(stateStr) });
            }
        }
        catch (err) {
            this.logger.error(`Error fetching state for reconnecting client: ${err?.message}`);
        }
        return { status: 'success', message: `Joined room ${gameSessionId}` };
    }
    async handleSubmitGuess(client, payload) {
        try {
            this.logger.log(`Received guess from client ${client.id}: ${JSON.stringify(payload)}`);
            const userId = client.data?.user?.sub || client.data?.user?.userId;
            if (!userId) {
                this.logger.error(`Unauthorized access attempt by client ${client.id}`);
                return { status: 'error', message: 'Unauthorized' };
            }
            if (this.isGuestRateLimited(String(userId))) {
                this.logger.warn(`Rate limit hit for user ${userId}`);
                client.emit('error', { message: 'Too many guesses — slow down.' });
                return { status: 'error', message: 'Rate limit exceeded' };
            }
            const { gameSessionId, guessName } = payload;
            if (!gameSessionId || !guessName) {
                this.logger.error(`Missing gameSessionId or guessName in payload`);
                return {
                    status: 'error',
                    message: 'Missing gameSessionId or guessName',
                };
            }
            const key = `game:${gameSessionId}`;
            this.clearTurnTimer(gameSessionId);
            this.logger.log(`Starting Redis transaction for gameSessionId: ${gameSessionId}`);
            await this.redisClient.watch(key);
            const stateStr = await this.redisClient.get(key);
            if (!stateStr) {
                await this.redisClient.unwatch();
                this.logger.error(`Game session not found: ${gameSessionId}`);
                return { status: 'error', message: 'Game session not found' };
            }
            const state = JSON.parse(stateStr);
            if (state.status === 'match_completed') {
                await this.redisClient.unwatch();
                this.logger.error(`Attempt to guess in completed match ${gameSessionId}`);
                return { status: 'error', message: 'Match is already completed' };
            }
            if (state.currentTurn !== userId) {
                await this.redisClient.unwatch();
                this.logger.error(`User ${userId} attempted to guess out of turn. Current turn: ${state.currentTurn}`);
                return { status: 'error', message: 'Not your turn' };
            }
            this.logger.log(`Performing fuzzy search for guess: "${guessName}"`);
            const matchedPlayer = await this.gameService.guessPlayer(guessName);
            this.logger.log(`Fuzzy search complete. Match found: ${!!matchedPlayer}`);
            let isCorrect = !!matchedPlayer;
            if (isCorrect) {
                if (state.guessedPlayers.some((g) => (typeof g === 'string' ? g : g?.name) === matchedPlayer.name)) {
                    isCorrect = false;
                    state.strikes[userId] += 1;
                }
                else {
                    state.guessedPlayers.push({ name: matchedPlayer.name, guessedBy: userId });
                    state.scores[userId] += 1;
                }
            }
            else {
                state.strikes[userId] += 1;
            }
            let isRoundOver = false;
            let isMatchOver = false;
            let roundWinner = null;
            if (state.strikes[userId] >= 3) {
                isRoundOver = true;
                const otherPlayer = state.players.find((p) => p !== userId) || state.players[0];
                roundWinner = otherPlayer;
                if (!Array.isArray(state.roundHistory))
                    state.roundHistory = [];
                if (!state.roundHistory.some((r) => r?.round === state.currentRound)) {
                    state.roundHistory.push({
                        round: state.currentRound,
                        winner: roundWinner,
                        scores: { ...(state.scores ?? {}) },
                    });
                }
                state.overallScores[otherPlayer] += 1;
                if (state.overallScores[otherPlayer] >= 2 || state.currentRound >= 3) {
                    isMatchOver = true;
                    state.status = 'match_completed';
                    state.winner =
                        state.overallScores[state.players[0]] >
                            state.overallScores[state.players[1]]
                            ? state.players[0]
                            : state.players[1];
                }
                else {
                    state.currentTurn = null;
                }
            }
            else {
                const otherPlayer = state.players.find((p) => p !== userId) || state.players[0];
                state.currentTurn = otherPlayer;
            }
            this.logger.log(`Executing Redis transaction to update state`);
            const multi = this.redisClient.multi();
            multi.set(key, JSON.stringify(state));
            if (isMatchOver) {
                this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
            }
            const results = await multi.exec();
            if (!results) {
                this.logger.error(`Redis transaction failed (concurrent modification) for gameSessionId: ${gameSessionId}`);
                await this.redisClient.unwatch().catch(() => { });
                this.startTurnTimer(gameSessionId);
                return {
                    status: 'error',
                    message: 'Concurrent modification, try again',
                };
            }
            this.logger.log(`Redis transaction successful for gameSessionId: ${gameSessionId}`);
            const updatePayload = {
                state,
                lastGuess: {
                    user: userId,
                    guess: guessName,
                    correct: isCorrect,
                    matchedName: isCorrect ? matchedPlayer.name : null,
                },
            };
            if (isMatchOver) {
                this.logger.log(`Broadcasting matchOver to room ${gameSessionId}`);
                this.clearTurnTimer(gameSessionId);
                const loserId = state.players.find((p) => p !== state.winner);
                const mmrDeltas = await this.resolveMmrDeltasForMatch(state, state.winner, loserId, false);
                this.server.to(gameSessionId).emit('matchOver', {
                    ...updatePayload,
                    forfeit: false,
                    mmrDeltas,
                });
                this.initializeRematch(gameSessionId, state).catch((e) => this.logger.error(`initializeRematch failed: ${e?.message}`));
            }
            else if (isRoundOver) {
                this.logger.log(`Broadcasting roundOver to room ${gameSessionId}`);
                this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
                this.server.to(gameSessionId).emit('roundOver', {
                    winner: roundWinner,
                    nextRoundIn: this.roundTransitionMs / 1000,
                });
                await this.sleep(this.roundTransitionMs);
                await this.redisClient.watch(key);
                const latestStr = await this.redisClient.get(key);
                if (!latestStr) {
                    await this.redisClient.unwatch();
                    return { status: 'error', message: 'Game session not found' };
                }
                const latest = JSON.parse(latestStr);
                if (latest.status === 'match_completed') {
                    await this.redisClient.unwatch();
                    return { status: 'success', isCorrect, matchedPlayer };
                }
                latest.currentRound += 1;
                latest.scores = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
                latest.strikes = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
                latest.guessedPlayers = [];
                latest.currentQuestion = (0, game_questions_1.pickRandomFootballQuestion)();
                if (latest.currentRound === 2)
                    latest.currentTurn = latest.players[1];
                else if (latest.currentRound === 3)
                    latest.currentTurn = latest.players[0];
                else
                    latest.currentTurn = latest.players[0];
                const multi2 = this.redisClient.multi();
                multi2.set(key, JSON.stringify(latest));
                const results2 = await multi2.exec();
                if (!results2) {
                    await this.redisClient.unwatch().catch(() => { });
                    this.startTurnTimer(gameSessionId);
                    return {
                        status: 'error',
                        message: 'Concurrent modification, try again',
                    };
                }
                await this.redisClient.unwatch().catch(() => { });
                const nextPayload = {
                    state: latest,
                    lastGuess: updatePayload.lastGuess,
                };
                this.logger.log(`Broadcasting nextRoundStarted to room ${gameSessionId}`);
                this.server.to(gameSessionId).emit('nextRoundStarted', nextPayload);
                this.startTurnTimer(gameSessionId);
            }
            else {
                this.logger.log(`Broadcasting gameStateUpdated to room ${gameSessionId}`);
                this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
                this.startTurnTimer(gameSessionId);
            }
            return { status: 'success', isCorrect, matchedPlayer };
        }
        catch (error) {
            this.logger.error(`Exception in handleSubmitGuess: ${error.message}`, error.stack);
            await this.redisClient.unwatch().catch(() => { });
            if (payload?.gameSessionId)
                this.startTurnTimer(payload.gameSessionId);
            return { status: 'error', message: 'Internal server error' };
        }
    }
    async handleForfeitMatch(client, gameSessionId) {
        const userId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!userId || !gameSessionId) {
            return { status: 'error', message: 'Invalid request' };
        }
        this.clearTurnTimer(gameSessionId);
        const gameKey = `game:${gameSessionId}`;
        try {
            await this.redisClient.watch(gameKey);
            const stateStr = await this.redisClient.get(gameKey);
            if (!stateStr) {
                await this.redisClient.unwatch();
                return { status: 'error', message: 'Game not found' };
            }
            const state = JSON.parse(stateStr);
            if (state.status === 'match_completed') {
                await this.redisClient.unwatch();
                return { status: 'error', message: 'Match already finished' };
            }
            if (!state.players?.includes(userId)) {
                await this.redisClient.unwatch();
                return { status: 'error', message: 'Not a player in this game' };
            }
            const winnerId = state.players.find((p) => p !== userId);
            state.status = 'match_completed';
            state.winner = winnerId;
            if (!Array.isArray(state.roundHistory))
                state.roundHistory = [];
            if (!state.roundHistory.some((r) => r?.round === state.currentRound)) {
                state.roundHistory.push({
                    round: state.currentRound,
                    winner: winnerId,
                    scores: { ...(state.scores ?? {}) },
                });
            }
            const multi = this.redisClient.multi();
            multi.set(gameKey, JSON.stringify(state));
            this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
            const results = await multi.exec();
            if (!results) {
                await this.redisClient.unwatch().catch(() => { });
                return { status: 'error', message: 'Concurrent update, try again' };
            }
            this.clearTurnTimer(gameSessionId);
            const mmrDeltas = await this.resolveMmrDeltasForMatch(state, winnerId, userId, true);
            this.server.to(gameSessionId).emit('matchOver', {
                state,
                forfeit: true,
                forfeitedByUserId: userId,
                mmrDeltas,
            });
            this.initializeRematch(gameSessionId, state).catch((e) => this.logger.error(`initializeRematch (manual forfeit) failed: ${e?.message}`));
            return { status: 'ok' };
        }
        catch (error) {
            this.logger.error(`Error in forfeitMatch: ${error?.message}`, error?.stack);
            return { status: 'error', message: 'Internal server error' };
        }
        finally {
            await this.redisClient.unwatch().catch(() => { });
        }
    }
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, schedule_1.Interval)(5000),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "broadcastFriendPresences", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinQueue'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('mode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleJoinQueue", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('cancelSearch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleCancelSearch", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('cancelPrivateRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleCancelPrivateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('createPrivateMatch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleCreatePrivateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('inviteFriendToGame'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('friendId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleInviteFriendToGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinPrivateMatch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('roomCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleJoinPrivateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('requestRematch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('gameSessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleRequestRematch", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveEndedMatch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('gameSessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleLeaveEndedMatch", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinGameRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('gameSessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleJoinGameRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('submitGuess'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleSubmitGuess", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('forfeitMatch'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('gameSessionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleForfeitMatch", null);
exports.GameGateway = GameGateway = GameGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        matchmaking_service_1.MatchmakingService,
        game_service_1.GameService,
        redis_service_1.RedisService,
        friends_service_1.FriendsService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map