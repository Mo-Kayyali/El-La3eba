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
const match_evaluator_util_1 = require("./match-evaluator.util");
const game_service_1 = require("./game.service");
const redis_service_1 = require("../redis/redis.service");
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const elo_util_1 = require("./elo.util");
const friends_service_1 = require("../friends/friends.service");
const users_service_1 = require("../users/users.service");
const strikes_mode_strategy_1 = require("./strikes-mode.strategy");
const top10_mode_strategy_1 = require("./top10-mode.strategy");
const GUESS_RATE_LIMIT_MAX = 5;
const GUESS_RATE_LIMIT_WINDOW_MS = 1000;
const WS_ALLOWED_ORIGINS = process.env.FRONTEND_URL
    ? [process.env.FRONTEND_URL, 'http://localhost:3001']
    : ['http://localhost:3001'];
let GameGateway = GameGateway_1 = class GameGateway {
    jwtService;
    matchmakingService;
    gameService;
    redisClient;
    friendsService;
    usersService;
    server;
    logger = new common_1.Logger(GameGateway_1.name);
    turnTimers = new Map();
    rematchTimers = new Map();
    disconnectTimers = new Map();
    guessTimestamps = new Map();
    inviteExpiryTimers = new Map();
    roundTransitionMs = 4000;
    DISCONNECT_GRACE_MS = 30_000;
    INVITE_COOLDOWN_SECONDS = 5;
    INVITE_TTL_SECONDS = 60;
    constructor(jwtService, matchmakingService, gameService, redisClient, friendsService, usersService) {
        this.jwtService = jwtService;
        this.matchmakingService = matchmakingService;
        this.gameService = gameService;
        this.redisClient = redisClient;
        this.friendsService = friendsService;
        this.usersService = usersService;
    }
    resolveStrategy(mode) {
        if (mode === 'TOP_10') {
            return new top10_mode_strategy_1.Top10ModeStrategy();
        }
        return new strikes_mode_strategy_1.StrikesModeStrategy();
    }
    flattenStateForFrontend(state) {
        if (!state)
            return state;
        const { modeState, ...envelope } = state;
        return { ...envelope, ...(modeState || {}) };
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    inviteCooldownKey(inviterId) {
        return `game_invite_cooldown:${inviterId}`;
    }
    inviteKey(inviterId, inviteeId) {
        return `game_invite:${inviterId}:${inviteeId}`;
    }
    invitesSentKey(inviterId) {
        return `game_invites_sent:${inviterId}`;
    }
    inviteTimerKey(inviterId, inviteeId) {
        return `${inviterId}:${inviteeId}`;
    }
    clearInviteExpiryTimer(inviterId, inviteeId) {
        const key = this.inviteTimerKey(inviterId, inviteeId);
        const timeout = this.inviteExpiryTimers.get(key);
        if (!timeout)
            return;
        clearTimeout(timeout);
        this.inviteExpiryTimers.delete(key);
    }
    scheduleInviteExpiry(inviterId, inviteeId) {
        this.clearInviteExpiryTimer(inviterId, inviteeId);
        const timeout = setTimeout(async () => {
            const timerKey = this.inviteTimerKey(inviterId, inviteeId);
            this.inviteExpiryTimers.delete(timerKey);
            const exists = await this.redisClient
                .exists(this.inviteKey(inviterId, inviteeId))
                .catch(() => 0);
            if (!exists) {
                await this.redisClient
                    .srem(this.invitesSentKey(inviterId), inviteeId)
                    .catch(() => { });
                return;
            }
            await this.redisClient
                .multi()
                .del(this.inviteKey(inviterId, inviteeId))
                .srem(this.invitesSentKey(inviterId), inviteeId)
                .exec()
                .catch(() => { });
            await this.matchmakingService
                .cancelPrivateRoom(inviterId)
                .catch(() => { });
            this.server.to(inviterId).emit('inviteCancelledBySystem', {
                inviterId,
                inviteeId,
                reason: 'invite_expired',
            });
        }, this.INVITE_TTL_SECONDS * 1000 + 250);
        this.inviteExpiryTimers.set(this.inviteTimerKey(inviterId, inviteeId), timeout);
    }
    async cancelActiveInvitesByInviter(inviterId, reason) {
        const inviteeIds = await this.redisClient
            .smembers(this.invitesSentKey(inviterId))
            .catch(() => []);
        if (!inviteeIds.length)
            return;
        const inviteKeys = inviteeIds.map((id) => this.inviteKey(inviterId, id));
        const multi = this.redisClient.multi();
        inviteKeys.forEach((k) => multi.del(k));
        multi.del(this.invitesSentKey(inviterId));
        await multi.exec().catch(() => { });
        await this.matchmakingService.cancelPrivateRoom(inviterId).catch(() => { });
        inviteeIds.forEach((inviteeId) => {
            this.clearInviteExpiryTimer(inviterId, inviteeId);
        });
        inviteeIds.forEach((inviteeId) => {
            this.server.to(inviteeId).emit('inviteCancelledBySystem', {
                inviterId,
                inviteeId,
                reason,
            });
        });
    }
    async cancelPendingInvitesForInvitee(inviteeId, reason) {
        const onlineUserIds = await this.redisClient
            .hkeys('presence')
            .catch(() => []);
        const inviters = new Set();
        await Promise.all(onlineUserIds
            .filter((uid) => uid !== inviteeId)
            .map(async (uid) => {
            const isMember = await this.redisClient
                .sismember(this.invitesSentKey(uid), inviteeId)
                .catch(() => 0);
            if (isMember)
                inviters.add(uid);
        }));
        if (!inviters.size)
            return;
        const multi = this.redisClient.multi();
        for (const inviterId of inviters) {
            multi.del(this.inviteKey(inviterId, inviteeId));
            multi.srem(this.invitesSentKey(inviterId), inviteeId);
        }
        await multi.exec().catch(() => { });
        await Promise.allSettled(Array.from(inviters).map((inviterId) => this.matchmakingService.cancelPrivateRoom(inviterId)));
        for (const inviterId of inviters) {
            this.clearInviteExpiryTimer(inviterId, inviteeId);
            this.server.to(inviterId).emit('inviteCancelledBySystem', {
                inviterId,
                inviteeId,
                reason,
            });
        }
    }
    emitFriendRequestReceived(recipientId, payload) {
        if (!this.server)
            return;
        const room = this.server.sockets.adapter.rooms.get(recipientId);
        if (!room || room.size === 0)
            return;
        this.server.to(recipientId).emit('friendRequestReceived', payload);
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
        const [userIds, presenceRaw] = await Promise.all([
            this.redisClient.hkeys('presence').catch(() => []),
            this.redisClient.hgetall('presence').catch(() => null),
        ]);
        if (!userIds.length || !presenceRaw)
            return;
        await Promise.all(userIds.map(async (userId) => {
            try {
                const friendIds = await this.friendsService.getAcceptedFriendIds(userId);
                if (!friendIds.length)
                    return;
                const friends = friendIds.map((friendId) => {
                    const raw = presenceRaw[friendId];
                    if (!raw)
                        return { userId: friendId, status: 'offline' };
                    if (raw.startsWith('in-game:')) {
                        return {
                            userId: friendId,
                            status: 'in-game',
                            gameSessionId: raw.slice('in-game:'.length),
                        };
                    }
                    return { userId: friendId, status: raw };
                });
                this.server.to(userId).emit('friendsPresenceUpdated', { friends });
            }
            catch (error) {
                this.logger.warn(`Presence broadcast skipped for ${userId}: ${error?.message}`);
            }
        }));
    }
    async resolveMmrDeltasForMatch(state, playerAId, playerBId, winnerId, forfeited) {
        if (!state?.isRanked || !playerAId || !playerBId)
            return undefined;
        if (winnerId === null) {
            const res = await this.matchmakingService.updateMmrAfterDraw(playerAId, playerBId);
            if (!res)
                return undefined;
            return { [playerAId]: res.deltaA, [playerBId]: res.deltaB };
        }
        const loserId = winnerId === playerAId ? playerBId : playerAId;
        const w = Number(state.modeState?.overallScores?.[winnerId] ?? 0);
        const l = Number(state.modeState?.overallScores?.[loserId] ?? 0);
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
                let state = JSON.parse(stateStr);
                if (state.status === 'match_completed') {
                    await this.redisClient.unwatch();
                    return;
                }
                const outcome = this.resolveStrategy(state.mode).handleDisconnectTimeout(state, userId);
                state = outcome.updatedState;
                const winnerId = outcome.winnerId;
                const ms = state.modeState;
                if (!Array.isArray(ms.roundHistory))
                    ms.roundHistory = [];
                if (!ms.roundHistory.some((r) => r?.round === ms.currentRound)) {
                    ms.roundHistory.push({
                        round: ms.currentRound,
                        winner: winnerId,
                        scores: { ...(ms.scores ?? {}) },
                    });
                }
                const multi = this.redisClient.multi();
                multi.set(gameKey, JSON.stringify(state));
                this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
                const results = await multi.exec();
                if (!results) {
                    await this.redisClient.unwatch().catch(() => { });
                    this.logger.debug(`Disconnect forfeit skipped due to concurrent update for game ${gameSessionId}`);
                    return;
                }
                this.clearTurnTimer(gameSessionId);
                const mmrDeltas = await this.resolveMmrDeltasForMatch(state, state.players[0], state.players[1], winnerId, true);
                const mmrLost = state.isRanked
                    ? Math.max(0, -(mmrDeltas?.[userId] ?? -15))
                    : 0;
                await this.usersService
                    .recordOfflinePenalty(userId, gameSessionId, mmrLost)
                    .catch((error) => {
                    const err = error;
                    this.logger.error(`Failed to persist offline penalty for ${userId}: ${err?.message}`);
                });
                const payload = {
                    state: this.flattenStateForFrontend(state),
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
    startTurnTimer(gameSessionId, remainingMs = 10_000) {
        this.clearTurnTimer(gameSessionId);
        const timeout = setTimeout(async () => {
            this.turnTimers.delete(gameSessionId);
            const key = `game:${gameSessionId}`;
            let attempt = 0;
            let success = false;
            let isRoundOver = false;
            let isMatchOver = false;
            let roundWinner = null;
            let state = null;
            while (attempt < 3 && !success) {
                try {
                    await this.redisClient.watch(key);
                    const stateStr = await this.redisClient.get(key);
                    if (!stateStr) {
                        await this.redisClient.unwatch();
                        return;
                    }
                    state = JSON.parse(stateStr);
                    if (state.status === 'match_completed') {
                        await this.redisClient.unwatch();
                        return;
                    }
                    const timedOutUserId = state.modeState.currentTurn;
                    if (!timedOutUserId) {
                        await this.redisClient.unwatch();
                        return;
                    }
                    const outcome = this.resolveStrategy(state.mode).handleTurnTimeout(state, timedOutUserId);
                    isRoundOver = outcome.isRoundOver ?? false;
                    roundWinner = 'roundWinner' in outcome ? (outcome.roundWinner ?? null) : null;
                    if (isRoundOver) {
                        const matchOutcome = (0, match_evaluator_util_1.checkBestOfNMatchWin)(state);
                        isMatchOver = matchOutcome.isMatchOver;
                        if (isMatchOver) {
                            state.status = 'match_completed';
                            state.winner = matchOutcome.winnerId;
                        }
                        const ms = state.modeState;
                        if (!Array.isArray(ms.roundHistory))
                            ms.roundHistory = [];
                        if (!ms.roundHistory.some((r) => r?.round === ms.currentRound)) {
                            ms.roundHistory.push({
                                round: ms.currentRound,
                                winner: roundWinner,
                                scores: { ...(ms.scores ?? {}) },
                            });
                        }
                    }
                    const multi = this.redisClient.multi();
                    multi.set(key, JSON.stringify(state));
                    if (isMatchOver) {
                        this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
                    }
                    const results = await multi.exec();
                    if (!results) {
                        attempt++;
                        if (attempt < 3)
                            await new Promise(res => setTimeout(res, 50));
                        continue;
                    }
                    success = true;
                }
                catch (e) {
                    await this.redisClient.unwatch().catch(() => { });
                    attempt++;
                    if (attempt < 3)
                        await new Promise(res => setTimeout(res, 50));
                }
            }
            if (!success) {
                this.logger.error(`Auto-strike timeout failed after 3 attempts (WATCH conflict) for gameSessionId: ${gameSessionId}`);
                return;
            }
            const updatePayload = {
                state: this.flattenStateForFrontend(state),
                lastGuess: {
                    user: state.modeState.currentTurn,
                    guess: null,
                    correct: false,
                    matchedName: null,
                    reason: 'timeout',
                },
            };
            this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
            if (isMatchOver) {
                this.clearTurnTimer(gameSessionId);
                const mmrDeltas = await this.resolveMmrDeltasForMatch(state, state.players[0], state.players[1], state.winner, false);
                this.server.to(gameSessionId).emit('matchOver', {
                    ...updatePayload,
                    forfeit: false,
                    mmrDeltas,
                });
                this.initializeRematch(gameSessionId, state).catch((e) => this.logger.error(`initializeRematch (turn timeout) failed: ${e?.message}`));
            }
            else if (isRoundOver) {
                this.server.to(gameSessionId).emit('roundOver', {
                    winner: roundWinner,
                    nextRoundIn: this.roundTransitionMs / 1000,
                });
                await this.sleep(this.roundTransitionMs);
                let nextRoundAttempt = 0;
                let nextRoundSuccess = false;
                let latest = null;
                while (nextRoundAttempt < 3 && !nextRoundSuccess) {
                    try {
                        await this.redisClient.watch(key);
                        const latestStr = await this.redisClient.get(key);
                        if (!latestStr) {
                            await this.redisClient.unwatch();
                            return;
                        }
                        latest = JSON.parse(latestStr);
                        if (latest.status === 'match_completed') {
                            await this.redisClient.unwatch();
                            return;
                        }
                        latest.modeState.currentRound += 1;
                        latest.modeState.roundWinnerId = null;
                        latest.mode = latest.composition[latest.modeState.currentRound - 1];
                        this.resolveStrategy(latest.mode).initializeRoundState(latest);
                        const nextQuestion = await this.gameService.getRandomQuestion(latest.mode, latest.modeState.usedQuestionIds || []);
                        latest.modeState.currentQuestion = nextQuestion;
                        if (nextQuestion) {
                            if (!latest.modeState.usedQuestionIds)
                                latest.modeState.usedQuestionIds = [];
                            latest.modeState.usedQuestionIds.push(nextQuestion.id);
                        }
                        const multi2 = this.redisClient.multi();
                        multi2.set(key, JSON.stringify(latest));
                        const results2 = await multi2.exec();
                        if (!results2) {
                            nextRoundAttempt++;
                            if (nextRoundAttempt < 3)
                                await new Promise(res => setTimeout(res, 50));
                            continue;
                        }
                        nextRoundSuccess = true;
                    }
                    catch (e) {
                        await this.redisClient.unwatch().catch(() => { });
                        nextRoundAttempt++;
                        if (nextRoundAttempt < 3)
                            await new Promise(res => setTimeout(res, 50));
                    }
                }
                if (!nextRoundSuccess) {
                    this.logger.error(`Failed to start next round after 3 attempts (WATCH conflict) for gameSessionId: ${gameSessionId}`);
                    return;
                }
                const nextPayload = {
                    state: this.flattenStateForFrontend(latest),
                    lastGuess: updatePayload.lastGuess,
                };
                this.server.to(gameSessionId).emit('nextRoundStarted', nextPayload);
                this.startTurnTimer(gameSessionId);
            }
            else {
                this.startTurnTimer(gameSessionId);
            }
        }, Math.max(0, remainingMs));
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
                this.friendsService
                    .countIncomingFriendRequests(userId)
                    .then((pendingIncomingFriendRequests) => {
                    client.emit('friendRequestCountSnapshot', {
                        pendingIncomingFriendRequests,
                    });
                })
                    .catch(() => { });
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
            await Promise.allSettled([
                this.matchmakingService.cancelSearch(userId),
                this.matchmakingService.cancelPrivateRoom(userId),
                this.cancelActiveInvitesByInviter(userId, 'inviter_offline'),
                this.cancelPendingInvitesForInvitee(userId, 'invitee_offline'),
            ]);
        }
        try {
            if (userId) {
                const gameSessionId = await this.matchmakingService.getActiveGameSessionIdForUser(userId);
                if (gameSessionId) {
                    this.startDisconnectTimer(gameSessionId, userId);
                    this.server
                        .to(gameSessionId)
                        .emit('playerDisconnected', { userId, gameSessionId });
                    this.logger.log(`User ${userId} disconnected from active game ${gameSessionId} — grace period started`);
                }
            }
        }
        catch (e) {
            this.logger.error(`Error in handleDisconnect cleanup: ${e?.message}`);
        }
        if (userId) {
            await this.clearPresence(userId).catch(() => { });
            this.guessTimestamps.delete(userId);
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
    async handleSendGameInvite(client, friendId, config) {
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
            const cooldownSet = await this.redisClient.set(this.inviteCooldownKey(userId), '1', 'EX', this.INVITE_COOLDOWN_SECONDS, 'NX');
            if (cooldownSet !== 'OK') {
                return {
                    status: 'error',
                    message: 'Please wait 5 seconds before sending another invite.',
                };
            }
            await this.friendsService.ensureUsersAreFriends(userId, friendId);
            await this.matchmakingService.cancelPrivateRoom(userId).catch(() => { });
            const roomCode = await this.matchmakingService.createPrivateRoom(userId, client.id, inviterUsername, config);
            await this.redisClient
                .multi()
                .set(this.inviteKey(userId, friendId), JSON.stringify({
                inviterId: userId,
                inviteeId: friendId,
                inviterUsername,
                roomCode,
                createdAt: new Date().toISOString(),
            }), 'EX', this.INVITE_TTL_SECONDS)
                .sadd(this.invitesSentKey(userId), friendId)
                .expire(this.invitesSentKey(userId), this.INVITE_TTL_SECONDS + 5)
                .exec();
            this.scheduleInviteExpiry(userId, friendId);
            const payload = {
                inviterId: userId,
                inviterUsername,
                roomCode,
                ...(config && { config }),
            };
            this.server.to(friendId).emit('friendGameInvite', payload);
            return { status: 'success', roomCode };
        }
        catch (error) {
            return {
                status: 'error',
                message: error?.message || 'Failed to invite friend',
            };
        }
    }
    async handleInviteFriendToGame(client, friendId, config) {
        return this.handleSendGameInvite(client, friendId, config);
    }
    async handleCancelGameInvite(client, friendId) {
        const inviterId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!inviterId)
            return { status: 'error', message: 'Unauthorized' };
        if (!friendId)
            return { status: 'error', message: 'friendId required' };
        const key = this.inviteKey(inviterId, friendId);
        const multi = this.redisClient.multi();
        multi.del(key);
        multi.srem(this.invitesSentKey(inviterId), friendId);
        const execResult = await multi.exec().catch(() => null);
        const deletedCount = execResult ? Number(execResult[0]?.[1] ?? 0) : 0;
        this.clearInviteExpiryTimer(inviterId, friendId);
        await this.matchmakingService.cancelPrivateRoom(inviterId).catch(() => { });
        if (deletedCount > 0) {
            this.server.to(friendId).emit('inviteCancelledBySystem', {
                inviterId,
                inviteeId: friendId,
                reason: 'inviter_cancelled',
            });
        }
        return { status: 'ok' };
    }
    async handleAcceptGameInvite(client, inviterId) {
        const inviteeId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!inviteeId)
            return { status: 'error', message: 'Unauthorized' };
        if (!inviterId)
            return { status: 'error', message: 'inviterId required' };
        const key = this.inviteKey(inviterId, inviteeId);
        const rawInvite = await this.redisClient.get(key);
        if (!rawInvite) {
            return { status: 'error', message: 'Invite expired or unavailable' };
        }
        let invite;
        try {
            invite = JSON.parse(rawInvite);
        }
        catch {
            await this.redisClient
                .multi()
                .del(key)
                .srem(this.invitesSentKey(inviterId), inviteeId)
                .exec()
                .catch(() => 0);
            return { status: 'error', message: 'Invite is invalid' };
        }
        await this.redisClient
            .multi()
            .del(key)
            .srem(this.invitesSentKey(inviterId), inviteeId)
            .exec();
        this.clearInviteExpiryTimer(inviterId, inviteeId);
        const username = client.data?.user?.username ||
            client.data?.user?.name ||
            client.data?.user?.email ||
            inviteeId;
        const joinResult = await this.matchmakingService.joinPrivateRoom(invite.roomCode, inviteeId, client.id, username);
        if (!joinResult?.success || !joinResult.gameSessionId) {
            this.server.to(inviterId).emit('inviteCancelledBySystem', {
                inviterId,
                inviteeId,
                reason: 'invite_expired',
            });
            return {
                status: 'error',
                message: joinResult?.error ?? 'Could not accept invite',
            };
        }
        this.server.to(inviterId).emit('inviteAccepted', {
            inviterId,
            inviteeId,
            gameSessionId: joinResult.gameSessionId,
        });
        return { status: 'ok', gameSessionId: joinResult.gameSessionId };
    }
    async handleDeclineGameInvite(client, inviterId) {
        const inviteeId = String(client.data?.user?.sub || client.data?.user?.userId || '');
        if (!inviteeId)
            return { status: 'error', message: 'Unauthorized' };
        if (!inviterId)
            return { status: 'error', message: 'inviterId required' };
        const key = this.inviteKey(inviterId, inviteeId);
        const multi2 = this.redisClient.multi();
        multi2.del(key);
        multi2.srem(this.invitesSentKey(inviterId), inviteeId);
        const execResult2 = await multi2.exec().catch(() => null);
        const deletedCount2 = execResult2 ? Number(execResult2[0]?.[1] ?? 0) : 0;
        if (deletedCount2 > 0) {
            await this.matchmakingService
                .cancelPrivateRoom(inviterId)
                .catch(() => { });
            this.clearInviteExpiryTimer(inviterId, inviteeId);
            this.server.to(inviterId).emit('inviteDeclined', {
                inviterId,
                inviteeId,
            });
        }
        return { status: 'ok' };
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
                return {
                    status: 'retry',
                    message: 'Concurrent update, please try again',
                };
            }
            this.server.to(gameSessionId).emit('rematchRequested', { userId });
            if (rematch.p1Ready && rematch.p2Ready) {
                this.clearRematchTimer(gameSessionId);
                await this.redisClient.del(rematchKey);
                const newGameSessionId = (0, crypto_1.randomUUID)();
                const newState = await this.matchmakingService.initializeGameState(newGameSessionId, rematch.p1Id, rematch.p2Id, rematch.p1Name, rematch.p2Name, rematch.isRanked === true);
                this.server.in(gameSessionId).socketsJoin(newGameSessionId);
                this.server.in(gameSessionId).socketsLeave(gameSessionId);
                await Promise.all([
                    this.setPresenceInGame(rematch.p1Id, newGameSessionId),
                    this.setPresenceInGame(rematch.p2Id, newGameSessionId),
                ]);
                this.server
                    .to(newGameSessionId)
                    .emit('rematchStarting', { newGameSessionId });
                this.server
                    .to(newGameSessionId)
                    .emit('gameStateUpdated', { state: newState });
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
            await Promise.allSettled([
                this.redisClient.del(`user_active_game:${userId}`),
                this.redisClient.del(`active_game:${userId}`),
            ]);
            await this.setPresenceOnline(userId);
            client.leave(gameSessionId);
            this.server
                .to(gameSessionId)
                .emit('opponentLeft', { userId, gameSessionId });
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
        const hadDisconnectTimer = this.disconnectTimers.has(this.disconnectTimerKey(gameSessionId, userId));
        this.clearDisconnectTimer(gameSessionId, userId);
        let parsedState = null;
        try {
            const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
            if (!stateStr) {
                return { status: 'error', message: 'Game session not found' };
            }
            parsedState = JSON.parse(stateStr);
            if (parsedState?.status === 'match_completed') {
                this.clearDisconnectTimer(gameSessionId, userId);
                client.emit('gameStateUpdated', { state: this.flattenStateForFrontend(parsedState) });
                return {
                    status: 'error',
                    message: 'Match is already completed',
                    finalState: parsedState,
                };
            }
        }
        catch (err) {
            this.logger.error(`Error fetching state before joinGameRoom: ${err?.message}`);
            return { status: 'error', message: 'Failed to load game state' };
        }
        client.join(gameSessionId);
        this.logger.log(`User ${userId} joined game room ${gameSessionId} (socket ${client.id})`);
        await Promise.allSettled([
            this.matchmakingService.cancelSearch(userId),
            this.matchmakingService.cancelPrivateRoom(userId),
            this.cancelActiveInvitesByInviter(userId, 'inviter_in_game'),
            this.cancelPendingInvitesForInvitee(userId, 'invitee_in_game'),
            this.matchmakingService.setActiveGameSessionIdForUser(userId, gameSessionId),
        ]);
        await this.setPresenceInGame(userId, gameSessionId).catch(() => { });
        if (hadDisconnectTimer) {
            const latestStateStr = await this.redisClient
                .get(`game:${gameSessionId}`)
                .catch(() => null);
            if (latestStateStr) {
                try {
                    const latestState = JSON.parse(latestStateStr);
                    if (latestState?.status === 'match_completed') {
                        client.emit('gameStateUpdated', { state: this.flattenStateForFrontend(latestState) });
                        return {
                            status: 'error',
                            message: 'Match is already completed',
                            finalState: latestState,
                        };
                    }
                }
                catch {
                    return {
                        status: 'error',
                        message: 'Failed to load game state',
                    };
                }
            }
            this.server
                .to(gameSessionId)
                .emit('playerReconnected', { userId, gameSessionId });
            let remainingMs = 10_000;
            if (latestStateStr) {
                try {
                    const latestState = JSON.parse(latestStateStr);
                    if (latestState.modeState?.turnDeadlineAt) {
                        remainingMs = latestState.modeState.turnDeadlineAt - Date.now();
                    }
                }
                catch { }
            }
            this.startTurnTimer(gameSessionId, remainingMs);
            this.logger.log(`User ${userId} reconnected to game ${gameSessionId} — timer resumed`);
        }
        client.emit('gameStateUpdated', { state: this.flattenStateForFrontend(parsedState) });
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
            this.logger.log(`Performing fuzzy search for guess: "${guessName}"`);
            const matchedPlayers = await this.gameService.guessPlayer(guessName);
            this.logger.log(`Fuzzy search complete. Matches found: ${matchedPlayers.length}`);
            let matchedPlayer = null;
            let initialIsCorrect = false;
            let answerDetails = null;
            if (matchedPlayers.length > 0) {
                const currentStateStr = await this.redisClient.get(key);
                if (currentStateStr) {
                    try {
                        const currentState = JSON.parse(currentStateStr);
                        if (currentState.modeState?.currentQuestion) {
                            for (const p of matchedPlayers) {
                                const alreadyGuessed = currentState.modeState.guessedPlayers?.some((g) => (typeof g === 'string' ? g : g?.name) === p.name);
                                if (alreadyGuessed)
                                    continue;
                                const isCorrect = await this.gameService.validateAnswer(currentState.modeState.currentQuestion, p);
                                if (isCorrect) {
                                    answerDetails = await this.gameService.validateAndGetAnswerDetails(currentState.modeState.currentQuestion.id, p.id);
                                }
                                if (isCorrect) {
                                    matchedPlayer = p;
                                    initialIsCorrect = true;
                                    break;
                                }
                            }
                            if (!matchedPlayer) {
                                if (matchedPlayers[0].isAmbiguous) {
                                    matchedPlayer = null;
                                }
                                else {
                                    matchedPlayer = matchedPlayers[0];
                                }
                                initialIsCorrect = false;
                            }
                        }
                    }
                    catch { }
                }
            }
            let attempt = 0;
            let success = false;
            let state = null;
            let isMatchOver = false;
            let isRoundOver = false;
            let roundWinner = null;
            let finalIsCorrect = false;
            while (attempt < 3 && !success) {
                try {
                    this.logger.log(`Starting Redis transaction for gameSessionId: ${gameSessionId}, attempt ${attempt + 1}`);
                    await this.redisClient.watch(key);
                    const stateStr = await this.redisClient.get(key);
                    if (!stateStr) {
                        await this.redisClient.unwatch();
                        this.logger.error(`Game session not found: ${gameSessionId}`);
                        return { status: 'error', message: 'Game session not found' };
                    }
                    state = JSON.parse(stateStr);
                    if (state.status === 'match_completed') {
                        await this.redisClient.unwatch();
                        this.logger.error(`Attempt to guess in completed match ${gameSessionId}`);
                        return { status: 'error', message: 'Match is already completed' };
                    }
                    if (state.modeState.roundWinnerId) {
                        await this.redisClient.unwatch();
                        return { status: 'error', message: 'Round already won, guess rejected.' };
                    }
                    finalIsCorrect = initialIsCorrect;
                    if (matchedPlayer &&
                        state.modeState.guessedPlayers.some((g) => (typeof g === 'string' ? g : g?.name) === matchedPlayer.name)) {
                        finalIsCorrect = false;
                    }
                    const outcome = this.resolveStrategy(state.mode).handleGuess(state, userId, {
                        isCorrect: finalIsCorrect,
                        matchedPlayer,
                        guessName,
                        answerDetails,
                    });
                    if (outcome.error) {
                        await this.redisClient.unwatch();
                        return { status: 'error', message: outcome.error };
                    }
                    isRoundOver = outcome.isRoundOver ?? false;
                    roundWinner = 'roundWinner' in outcome ? (outcome.roundWinner ?? null) : null;
                    if (isRoundOver) {
                        const matchOutcome = (0, match_evaluator_util_1.checkBestOfNMatchWin)(state);
                        isMatchOver = matchOutcome.isMatchOver;
                        if (isMatchOver) {
                            state.status = 'match_completed';
                            state.winner = matchOutcome.winnerId;
                        }
                        const ms = state.modeState;
                        ms.roundWinnerId = roundWinner;
                        if (!Array.isArray(ms.roundHistory))
                            ms.roundHistory = [];
                        if (!ms.roundHistory.some((r) => r?.round === ms.currentRound)) {
                            ms.roundHistory.push({
                                round: ms.currentRound,
                                winner: roundWinner,
                                scores: { ...(ms.scores ?? {}) },
                            });
                        }
                    }
                    const multi = this.redisClient.multi();
                    multi.set(key, JSON.stringify(state));
                    if (isMatchOver) {
                        this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
                    }
                    const results = await multi.exec();
                    if (!results) {
                        attempt++;
                        if (attempt < 3)
                            await new Promise(res => setTimeout(res, 50));
                        continue;
                    }
                    success = true;
                }
                catch (err) {
                    await this.redisClient.unwatch().catch(() => { });
                    attempt++;
                    if (attempt < 3)
                        await new Promise(res => setTimeout(res, 50));
                }
            }
            if (!success) {
                this.logger.error(`handleSubmitGuess failed after 3 attempts (WATCH conflict) for gameSessionId: ${gameSessionId}`);
                return {
                    status: 'error',
                    message: 'Concurrent modification, try again',
                };
            }
            this.logger.log(`Redis transaction successful for gameSessionId: ${gameSessionId}`);
            const updatePayload = {
                state: this.flattenStateForFrontend(state),
                lastGuess: {
                    user: userId,
                    guess: guessName,
                    correct: finalIsCorrect,
                    matchedName: finalIsCorrect ? matchedPlayer.name : null,
                },
            };
            if (isMatchOver) {
                this.logger.log(`Broadcasting matchOver to room ${gameSessionId}`);
                this.clearTurnTimer(gameSessionId);
                const mmrDeltas = await this.resolveMmrDeltasForMatch(state, state.players[0], state.players[1], state.winner, false);
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
                let nextRoundAttempt = 0;
                let nextRoundSuccess = false;
                let latest = null;
                while (nextRoundAttempt < 3 && !nextRoundSuccess) {
                    try {
                        await this.redisClient.watch(key);
                        const latestStr = await this.redisClient.get(key);
                        if (!latestStr) {
                            await this.redisClient.unwatch();
                            return { status: 'error', message: 'Game session not found' };
                        }
                        latest = JSON.parse(latestStr);
                        if (latest.status === 'match_completed') {
                            await this.redisClient.unwatch();
                            return { status: 'success', isCorrect: finalIsCorrect, matchedPlayer };
                        }
                        latest.modeState.currentRound += 1;
                        latest.modeState.roundWinnerId = null;
                        latest.mode = latest.composition[latest.modeState.currentRound - 1];
                        this.resolveStrategy(latest.mode).initializeRoundState(latest);
                        const nextQuestion = await this.gameService.getRandomQuestion(latest.mode, latest.modeState.usedQuestionIds || []);
                        latest.modeState.currentQuestion = nextQuestion;
                        if (nextQuestion) {
                            if (!latest.modeState.usedQuestionIds)
                                latest.modeState.usedQuestionIds = [];
                            latest.modeState.usedQuestionIds.push(nextQuestion.id);
                        }
                        const multi2 = this.redisClient.multi();
                        multi2.set(key, JSON.stringify(latest));
                        const results2 = await multi2.exec();
                        if (!results2) {
                            nextRoundAttempt++;
                            if (nextRoundAttempt < 3)
                                await new Promise(res => setTimeout(res, 50));
                            continue;
                        }
                        nextRoundSuccess = true;
                    }
                    catch (err) {
                        await this.redisClient.unwatch().catch(() => { });
                        nextRoundAttempt++;
                        if (nextRoundAttempt < 3)
                            await new Promise(res => setTimeout(res, 50));
                    }
                }
                if (!nextRoundSuccess) {
                    this.logger.error(`Failed to transition to next round after 3 attempts for ${gameSessionId}`);
                    return { status: 'error', message: 'Concurrent modification, try again' };
                }
                const nextPayload = {
                    state: this.flattenStateForFrontend(latest),
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
            return { status: 'success', isCorrect: finalIsCorrect, matchedPlayer };
        }
        catch (error) {
            this.logger.error(`Exception in handleSubmitGuess: ${error.message}`, error.stack);
            await this.redisClient.unwatch().catch(() => { });
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
            const outcome = this.resolveStrategy(state.mode).handleForfeit(state, userId);
            const forfeitedState = outcome.updatedState;
            const winnerId = outcome.winnerId;
            const multi = this.redisClient.multi();
            multi.set(gameKey, JSON.stringify(forfeitedState));
            this.matchmakingService.deleteActiveGameKeysInMulti(multi, forfeitedState.players);
            const results = await multi.exec();
            if (!results) {
                await this.redisClient.unwatch().catch(() => { });
                return { status: 'error', message: 'Concurrent update, try again' };
            }
            this.clearTurnTimer(gameSessionId);
            const mmrDeltas = await this.resolveMmrDeltasForMatch(forfeitedState, forfeitedState.players[0], forfeitedState.players[1], winnerId, true);
            this.server.to(gameSessionId).emit('matchOver', {
                state: this.flattenStateForFrontend(forfeitedState),
                forfeit: true,
                forfeitedByUserId: userId,
                mmrDeltas,
            });
            this.initializeRematch(gameSessionId, forfeitedState).catch((e) => this.logger.error(`initializeRematch (manual forfeit) failed: ${e?.message}`));
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
    (0, websockets_1.SubscribeMessage)('sendGameInvite'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('friendId')),
    __param(2, (0, websockets_1.MessageBody)('config')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleSendGameInvite", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('inviteFriendToGame'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('friendId')),
    __param(2, (0, websockets_1.MessageBody)('config')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String, Object]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleInviteFriendToGame", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('cancelGameInvite'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('friendId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleCancelGameInvite", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('acceptGameInvite'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('inviterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleAcceptGameInvite", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('declineGameInvite'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('inviterId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleDeclineGameInvite", null);
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
    (0, websockets_1.WebSocketGateway)({ cors: { origin: WS_ALLOWED_ORIGINS, credentials: true } }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        matchmaking_service_1.MatchmakingService,
        game_service_1.GameService,
        redis_service_1.RedisService,
        friends_service_1.FriendsService,
        users_service_1.UsersService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map