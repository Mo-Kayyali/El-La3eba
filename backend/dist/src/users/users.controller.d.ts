import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    getPublicProfile(userId: string): Promise<{
        id: string;
        username: string;
        gamesPlayed: number;
        wins: number;
    }>;
    updateOwnProfile(req: {
        user: {
            userId: string;
        };
    }, dto: UpdateProfileDto): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        username: string;
        isVerified: boolean;
        mmr: number;
        gamesPlayed: number;
        wins: number;
    }>;
}
