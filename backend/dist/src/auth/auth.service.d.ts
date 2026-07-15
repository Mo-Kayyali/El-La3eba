import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private prisma;
    private jwtService;
    private redisService;
    constructor(prisma: PrismaService, jwtService: JwtService, redisService: RedisService);
    private penaltyKey;
    private activeGameKey;
    private getPendingOfflinePenalty;
    register(dto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            email: any;
            isVerified: any;
            mmr: any;
        };
    }>;
    login(dto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            email: any;
            isVerified: any;
            mmr: any;
        };
    }>;
    getProfileById(userId: string): Promise<{
        activeGameSessionId: string | null;
        pendingIncomingFriendRequests: number;
        pendingOfflinePenalty: {
            id: string;
            mmrLost: number;
            gameSessionId: string;
            createdAt: string;
        } | null;
        email: string;
        username: string;
        id: string;
        createdAt: Date;
        isVerified: boolean;
        mmr: number;
        gamesPlayed: number;
        wins: number;
        offlineDisconnectCount: number;
        lastDisconnectAt: Date | null;
    }>;
    acknowledgeOfflinePenalty(userId: string): Promise<{
        success: boolean;
        cleared: number;
    }>;
    private generateToken;
    requestVerification(userId: string, email: string): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyEmail(userId: string, code: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
