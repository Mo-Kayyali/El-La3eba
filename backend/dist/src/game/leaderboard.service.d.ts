import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
export interface LeaderboardEntry {
    id: string;
    username: string;
    mmr: number;
    wins: number;
    gamesPlayed: number;
}
export declare class LeaderboardService {
    private readonly prisma;
    private readonly redisClient;
    private readonly logger;
    static readonly CACHE_KEY = "global_leaderboard";
    private readonly CACHE_TTL;
    constructor(prisma: PrismaService, redisClient: RedisService);
    refreshLeaderboard(): Promise<void>;
    getLeaderboard(): Promise<LeaderboardEntry[]>;
}
