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
exports.GameGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const matchmaking_service_1 = require("./matchmaking.service");
let GameGateway = class GameGateway {
    jwtService;
    matchmakingService;
    server;
    constructor(jwtService, matchmakingService) {
        this.jwtService = jwtService;
        this.matchmakingService = matchmakingService;
    }
    afterInit(server) {
        this.matchmakingService.setServer(server);
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
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
exports.GameGateway = GameGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        matchmaking_service_1.MatchmakingService])
], GameGateway);
//# sourceMappingURL=game.gateway.js.map