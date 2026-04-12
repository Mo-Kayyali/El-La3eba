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
        pendingIncomingFriendRequests: number;
        id: string;
        email: string;
        username: string;
        isVerified: boolean;
        mmr: number;
        gamesPlayed: number;
        wins: number;
        createdAt: Date;
    }>;
    requestVerification(req: any): Promise<{
        success: boolean;
        message: string;
    }>;
    verifyEmail(req: any, code: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
