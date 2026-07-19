import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
export declare class FriendsController {
    private readonly friendsService;
    constructor(friendsService: FriendsService);
    sendFriendRequest(req: {
        user: {
            userId: string;
        };
    }, dto: SendFriendRequestDto): Promise<{
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
    acceptFriendRequest(req: {
        user: {
            userId: string;
        };
    }, requestId: string): Promise<{
        accepted: boolean;
    }>;
    rejectFriendRequest(req: {
        user: {
            userId: string;
        };
    }, requestId: string): Promise<{
        rejected: boolean;
    }>;
    cancelOutgoingRequest(req: {
        user: {
            userId: string;
        };
    }, requestId: string): Promise<{
        cancelled: boolean;
    }>;
    removeFriend(req: {
        user: {
            userId: string;
        };
    }, friendshipId: string): Promise<{
        removed: boolean;
    }>;
    listFriends(req: {
        user: {
            userId: string;
        };
    }): Promise<{
        friends: {
            presence: {
                status: "offline" | "online" | "in-game";
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
}
