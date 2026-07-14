import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersService {
    private readonly prisma;
    private readonly redis;
    constructor(prisma: PrismaService, redis: RedisService);
    private penaltyKey;
    recordOfflinePenalty(userId: string, gameSessionId: string, mmrLost: number): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        acknowledgedAt: Date | null;
        mmrLost: number;
        gameSessionId: string;
    }>;
    getPendingOfflinePenalty(userId: string): Promise<{
        id: string;
        mmrLost: number;
        gameSessionId: string;
        createdAt: string;
    } | null>;
    acknowledgeOfflinePenalty(userId: string): Promise<{
        success: boolean;
        cleared: number;
    }>;
    getPublicProfileById(userId: string): Promise<{
        username: string;
        id: string;
        gamesPlayed: number;
        wins: number;
    }>;
    updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<{
        email: string;
        username: string;
        id: string;
        isVerified: boolean;
        mmr: number;
        gamesPlayed: number;
        wins: number;
        createdAt: Date;
    }>;
}
