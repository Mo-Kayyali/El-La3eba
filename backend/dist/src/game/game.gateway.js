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
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const matchmaking_service_1 = require("./matchmaking.service");
const game_service_1 = require("./game.service");
const redis_service_1 = require("../redis/redis.service");
const common_1 = require("@nestjs/common");
let GameGateway = GameGateway_1 = class GameGateway {
    jwtService;
    matchmakingService;
    gameService;
    redisClient;
    server;
    logger = new common_1.Logger(GameGateway_1.name);
    constructor(jwtService, matchmakingService, gameService, redisClient) {
        this.jwtService = jwtService;
        this.matchmakingService = matchmakingService;
        this.gameService = gameService;
        this.redisClient = redisClient;
    }
    afterInit(server) {
        this.matchmakingService.setServer(server);
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ||
                client.handshake.headers?.authorization?.split(' ')[1];
            if (!token) {
                console.log(`Connection rejected: Missing token for client ${client.id}`);
                client.disconnect();
                return;
            }
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
            });
            client.data.user = payload;
            console.log(`Client connected: ${client.id} (User ID: ${payload.sub || payload.userId})`);
        }
        catch (error) {
            console.log(`Connection rejected: Invalid token for client ${client.id}`);
            client.disconnect();
        }
    }
    handleDisconnect(client) {
        console.log(`Client disconnected: ${client.id}`);
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (userId) {
            this.matchmakingService.leaveQueue(userId);
        }
    }
    async handleJoinQueue(client) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        await this.matchmakingService.joinQueue(userId, client.id);
        return { status: 'queued' };
    }
    async handleCreatePrivateRoom(client) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        const roomCode = await this.matchmakingService.createPrivateRoom(userId, client.id);
        return { status: 'success', roomCode };
    }
    async handleJoinPrivateRoom(client, roomCode) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        if (!roomCode)
            return { status: 'error', message: 'Room code required' };
        const result = await this.matchmakingService.joinPrivateRoom(roomCode, userId, client.id);
        return result;
    }
    async handleJoinGameRoom(client, gameSessionId) {
        const userId = client.data?.user?.sub || client.data?.user?.userId;
        if (!userId)
            return { status: 'error', message: 'Unauthorized' };
        if (!gameSessionId)
            return { status: 'error', message: 'gameSessionId required' };
        client.join(gameSessionId);
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
            const { gameSessionId, guessName } = payload;
            if (!gameSessionId || !guessName) {
                this.logger.error(`Missing gameSessionId or guessName in payload`);
                return {
                    status: 'error',
                    message: 'Missing gameSessionId or guessName',
                };
            }
            const key = `game:${gameSessionId}`;
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
            const isCorrect = !!matchedPlayer;
            if (isCorrect) {
                if (state.guessedPlayers.includes(matchedPlayer.name)) {
                    await this.redisClient.unwatch();
                    this.logger.error(`Player ${matchedPlayer.name} already guessed this round by user ${userId}`);
                    return {
                        status: 'error',
                        message: 'Player already guessed this round',
                    };
                }
                state.guessedPlayers.push(matchedPlayer.name);
                state.scores[userId] += 1;
            }
            else {
                state.strikes[userId] += 1;
            }
            let isRoundOver = false;
            let isMatchOver = false;
            if (state.strikes[userId] >= 3) {
                isRoundOver = true;
                const otherPlayer = state.players.find((p) => p !== userId) || state.players[0];
                state.overallScores[otherPlayer] += 1;
                if (state.overallScores[otherPlayer] >= 2 || state.currentRound >= 3) {
                    isMatchOver = true;
                    state.status = 'match_completed';
                    state.winner = state.overallScores[state.players[0]] > state.overallScores[state.players[1]] ? state.players[0] : state.players[1];
                }
                else {
                    state.currentRound += 1;
                    state.scores = { [state.players[0]]: 0, [state.players[1]]: 0 };
                    state.strikes = { [state.players[0]]: 0, [state.players[1]]: 0 };
                    state.guessedPlayers = [];
                    const questions = [
                        "Name a football player who played in 2026",
                        "Name a player who has won the Champions League",
                        "Name a player who has played in the Premier League",
                        "Name a player who has won the World Cup"
                    ];
                    state.currentQuestion = questions[(state.currentRound - 1) % questions.length];
                    state.currentTurn = userId;
                }
            }
            else {
                const otherPlayer = state.players.find((p) => p !== userId) || state.players[0];
                state.currentTurn = otherPlayer;
            }
            this.logger.log(`Executing Redis transaction to update state`);
            const multi = this.redisClient.multi();
            multi.set(key, JSON.stringify(state));
            const results = await multi.exec();
            if (!results) {
                this.logger.error(`Redis transaction failed (concurrent modification) for gameSessionId: ${gameSessionId}`);
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
                this.server.to(gameSessionId).emit('matchOver', updatePayload);
            }
            else if (isRoundOver) {
                this.logger.log(`Broadcasting nextRoundStarted to room ${gameSessionId}`);
                this.server.to(gameSessionId).emit('nextRoundStarted', updatePayload);
            }
            else {
                this.logger.log(`Broadcasting gameStateUpdated to room ${gameSessionId}`);
                this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
            }
            return { status: 'success', isCorrect, matchedPlayer };
        }
        catch (error) {
            this.logger.error(`Exception in handleSubmitGuess: ${error.message}`, error.stack);
            await this.redisClient.unwatch().catch(() => { });
            return { status: 'error', message: 'Internal server error' };
        }
    }
};
exports.GameGateway = GameGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], GameGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinQueue'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleJoinQueue", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('createPrivateRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleCreatePrivateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinPrivateRoom'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)('roomCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", Promise)
], GameGateway.prototype, "handleJoinPrivateRoom", null);
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
exports.GameGateway = GameGateway = GameGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        matchmaking_service_1.MatchmakingService,
        game_service_1.GameService,
        redis_service_1.RedisService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map