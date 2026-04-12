import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPublicProfileById(userId: string): Promise<{
        id: string;
        username: string;
        gamesPlayed: number;
        wins: number;
    }>;
    updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<{
        id: string;
        email: string;
        username: string;
        isVerified: boolean;
        mmr: number;
        gamesPlayed: number;
        wins: number;
        createdAt: Date;
    }>;
}
