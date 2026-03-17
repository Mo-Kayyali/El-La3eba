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
        };
    }>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: any;
            username: any;
            email: any;
            isVerified: any;
        };
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
