import { PrismaService } from '../prisma/prisma.service';
export declare class PlayerDenormService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    regenerateForPlayer(playerId: string): Promise<{
        clubs: string[];
        competitions: string[];
    }>;
    regenerateForClub(clubId: string): Promise<void>;
}
