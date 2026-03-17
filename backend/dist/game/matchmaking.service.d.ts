import { RedisService } from '../redis/redis.service';
import { Server } from 'socket.io';
export declare class MatchmakingService {
    private readonly redisClient;
    private readonly logger;
    private server;
    constructor(redisClient: RedisService);
    setServer(server: Server): void;
    joinQueue(userId: string, socketId: string): Promise<void>;
    leaveQueue(userId: string): Promise<void>;
    handleMatchmakingInterval(): Promise<void>;
    createPrivateRoom(userId: string, socketId: string): Promise<string>;
    joinPrivateRoom(code: string, userId: string, socketId: string): Promise<{
        success: boolean;
        error: string;
        gameSessionId?: undefined;
    } | {
        success: boolean;
        gameSessionId: `${string}-${string}-${string}-${string}-${string}`;
        error?: undefined;
    }>;
}
