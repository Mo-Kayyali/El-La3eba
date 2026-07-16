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
        mmrLost: number;
        gameSessionId: string;
        acknowledgedAt: Date | null;
    }>;
    getPendingOfflinePenalty(userId: string): Promise<{
        id: string;
        mmrLost: number;
        gameSessionId: string;
        createdAt: string;
    } | null>;
    getPublicProfileById(userId: string): Promise<{
        id: string;
        username: string;
        gamesPlayed: number;
        wins: number;
    }>;
    updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string;
        createdAt: Date;
        username: string;
        isVerified: boolean;
        mmr: number;
        gamesPlayed: number;
        wins: number;
    }>;
}
