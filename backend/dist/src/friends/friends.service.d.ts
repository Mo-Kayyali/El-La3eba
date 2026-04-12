import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameGateway } from '../game/game.gateway';
type PresenceStatus = 'offline' | 'online' | 'in-game';
export declare class FriendsService {
    private readonly prisma;
    private readonly redisClient;
    private readonly gameGateway;
    constructor(prisma: PrismaService, redisClient: RedisService, gameGateway: GameGateway);
    private resolveUserByIdentifier;
    private getPresenceStatus;
    private mapFriendship;
    sendFriendRequest(requesterId: string, identifier: string): Promise<{
        created: boolean;
        accepted: boolean;
        friendship: {
            friendshipId: string;
            userId: string;
            username: string;
            status: import(".prisma/client").$Enums.FriendshipStatus;
            createdAt: Date;
        };
    }>;
    acceptFriendRequest(currentUserId: string, requestId: string): Promise<{
        accepted: boolean;
    }>;
    rejectFriendRequest(currentUserId: string, requestId: string): Promise<{
        rejected: boolean;
    }>;
    cancelOutgoingRequest(currentUserId: string, requestId: string): Promise<{
        cancelled: boolean;
    }>;
    removeFriend(currentUserId: string, friendshipId: string): Promise<{
        removed: boolean;
    }>;
    getFriendsList(currentUserId: string): Promise<{
        friends: {
            presence: {
                status: PresenceStatus;
                gameSessionId: string | null;
            };
            friendshipId: string;
            userId: string;
            username: string;
            status: import(".prisma/client").$Enums.FriendshipStatus;
            createdAt: Date;
        }[];
        incomingRequests: {
            friendshipId: string;
            userId: string;
            username: string;
            status: import(".prisma/client").$Enums.FriendshipStatus;
            createdAt: Date;
        }[];
        outgoingRequests: {
            friendshipId: string;
            userId: string;
            username: string;
            status: import(".prisma/client").$Enums.FriendshipStatus;
            createdAt: Date;
        }[];
    }>;
    getFriendPresenceSnapshot(currentUserId: string): Promise<{
        userId: string;
        username: string;
        status: PresenceStatus;
        gameSessionId: string | null;
    }[]>;
    ensureUsersAreFriends(userId: string, otherUserId: string): Promise<void>;
    countIncomingFriendRequests(userId: string): Promise<number>;
}
export {};
