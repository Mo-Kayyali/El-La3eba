import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            email: any;
            isVerified: any;
            mmr: any;
        };
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            email: any;
            isVerified: any;
            mmr: any;
        };
    }>;
    me(req: {
        user: {
            userId: string;
        };
    }): Promise<{
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
    requestVerification(req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyEmail(req: any, code: string): Promise<{
        success: boolean;
        message: string;
    }>;
    acknowledgeOfflinePenalty(req: {
        user: {
            userId: string;
        };
    }): Promise<{
        success: boolean;
        cleared: number;
    }>;
}
