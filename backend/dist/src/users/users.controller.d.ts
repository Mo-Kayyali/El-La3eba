import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getPublicProfile(userId: string): Promise<{
        username: string;
        id: string;
        gamesPlayed: number;
        wins: number;
    }>;
    updateOwnProfile(req: {
        user: {
            userId: string;
        };
    }, dto: UpdateProfileDto): Promise<{
        email: string;
        username: string;
        id: string;
        createdAt: Date;
        isVerified: boolean;
        mmr: number;
        gamesPlayed: number;
        wins: number;
    }>;
}
