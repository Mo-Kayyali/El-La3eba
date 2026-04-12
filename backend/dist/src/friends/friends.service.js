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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriendsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let FriendsService = class FriendsService {
    prisma;
    redisClient;
    constructor(prisma, redisClient) {
        this.prisma = prisma;
        this.redisClient = redisClient;
    }
    async resolveUserByIdentifier(identifier) {
        return this.prisma.user.findFirst({
            where: {
                OR: [
                    { id: identifier },
                    { username: { equals: identifier, mode: 'insensitive' } },
                ],
            },
            select: { id: true, username: true },
        });
    }
    async getPresenceStatus(userId) {
        const raw = await this.redisClient.hget('presence', userId);
        if (!raw)
            return { status: 'offline', gameSessionId: null };
        if (raw.startsWith('in-game:')) {
            return { status: 'in-game', gameSessionId: raw.slice('in-game:'.length) };
        }
        return { status: 'online', gameSessionId: null };
    }
    mapFriendship(friendship, currentUserId) {
        const otherUser = friendship.userId === currentUserId ? friendship.friend : friendship.user;
        return {
            friendshipId: friendship.id,
            userId: otherUser.id,
            username: otherUser.username,
            status: friendship.status,
            createdAt: friendship.createdAt,
        };
    }
    async sendFriendRequest(requesterId, identifier) {
        if (!identifier?.trim()) {
            throw new common_1.BadRequestException('Provide a username or UUID');
        }
        const target = await this.resolveUserByIdentifier(identifier.trim());
        if (!target) {
            throw new common_1.NotFoundException('User not found');
        }
        if (target.id === requesterId) {
            throw new common_1.BadRequestException('You cannot friend yourself');
        }
        const [existingOutgoing, existingIncoming] = await Promise.all([
            this.prisma.friendship.findUnique({
                where: {
                    userId_friendId: { userId: requesterId, friendId: target.id },
                },
            }),
            this.prisma.friendship.findUnique({
                where: {
                    userId_friendId: { userId: target.id, friendId: requesterId },
                },
            }),
        ]);
        if (existingOutgoing?.status === client_1.FriendshipStatus.ACCEPTED ||
            existingIncoming?.status === client_1.FriendshipStatus.ACCEPTED) {
            throw new common_1.ConflictException('You are already friends');
        }
        if (existingOutgoing?.status === client_1.FriendshipStatus.PENDING) {
            throw new common_1.ConflictException('Friend request already sent');
        }
        if (existingIncoming?.status === client_1.FriendshipStatus.PENDING) {
            const accepted = await this.prisma.friendship.update({
                where: { id: existingIncoming.id },
                data: { status: client_1.FriendshipStatus.ACCEPTED },
                include: { user: true, friend: true },
            });
            return {
                created: false,
                accepted: true,
                friendship: this.mapFriendship(accepted, requesterId),
            };
        }
        const created = await this.prisma.friendship.create({
            data: {
                userId: requesterId,
                friendId: target.id,
                status: client_1.FriendshipStatus.PENDING,
            },
            include: { user: true, friend: true },
        });
        return {
            created: true,
            accepted: false,
            friendship: this.mapFriendship(created, requesterId),
        };
    }
    async acceptFriendRequest(currentUserId, requestId) {
        const request = await this.prisma.friendship.findFirst({
            where: { id: requestId, friendId: currentUserId },
        });
        if (!request) {
            throw new common_1.NotFoundException('Friend request not found');
        }
        if (request.status === client_1.FriendshipStatus.ACCEPTED) {
            return { accepted: true };
        }
        await this.prisma.friendship.update({
            where: { id: request.id },
            data: { status: client_1.FriendshipStatus.ACCEPTED },
        });
        return { accepted: true };
    }
    async rejectFriendRequest(currentUserId, requestId) {
        const request = await this.prisma.friendship.findFirst({
            where: {
                id: requestId,
                friendId: currentUserId,
                status: client_1.FriendshipStatus.PENDING,
            },
        });
        if (!request) {
            throw new common_1.NotFoundException('Friend request not found');
        }
        await this.prisma.friendship.delete({ where: { id: request.id } });
        return { rejected: true };
    }
    async getFriendsList(currentUserId) {
        const [friendships, incomingRequests, outgoingRequests] = await Promise.all([
            this.prisma.friendship.findMany({
                where: {
                    status: client_1.FriendshipStatus.ACCEPTED,
                    OR: [{ userId: currentUserId }, { friendId: currentUserId }],
                },
                include: { user: true, friend: true },
                orderBy: { updatedAt: 'desc' },
            }),
            this.prisma.friendship.findMany({
                where: { friendId: currentUserId, status: client_1.FriendshipStatus.PENDING },
                include: { user: true, friend: true },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.friendship.findMany({
                where: { userId: currentUserId, status: client_1.FriendshipStatus.PENDING },
                include: { user: true, friend: true },
                orderBy: { createdAt: 'desc' },
            }),
        ]);
        const friends = await Promise.all(friendships.map(async (friendship) => {
            const base = this.mapFriendship(friendship, currentUserId);
            const presence = await this.getPresenceStatus(base.userId);
            return { ...base, presence };
        }));
        const incoming = incomingRequests.map((friendship) => this.mapFriendship(friendship, currentUserId));
        const outgoing = outgoingRequests.map((friendship) => this.mapFriendship(friendship, currentUserId));
        return { friends, incomingRequests: incoming, outgoingRequests: outgoing };
    }
    async getFriendPresenceSnapshot(currentUserId) {
        const list = await this.getFriendsList(currentUserId);
        return list.friends.map((friend) => ({
            userId: friend.userId,
            username: friend.username,
            status: friend.presence.status,
            gameSessionId: friend.presence.gameSessionId,
        }));
    }
    async ensureUsersAreFriends(userId, otherUserId) {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                status: client_1.FriendshipStatus.ACCEPTED,
                OR: [
                    { userId, friendId: otherUserId },
                    { userId: otherUserId, friendId: userId },
                ],
            },
        });
        if (!friendship) {
            throw new common_1.BadRequestException('You can only invite accepted friends');
        }
    }
};
exports.FriendsService = FriendsService;
exports.FriendsService = FriendsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], FriendsService);
//# sourceMappingURL=friends.service.js.map