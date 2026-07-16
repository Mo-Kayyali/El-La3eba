import { PrismaService } from '../prisma/prisma.service';
import { PlayerDenormService } from './player-denorm.service';
export declare class ClubDenormService {
    private prisma;
    private playerDenormService;
    constructor(prisma: PrismaService, playerDenormService: PlayerDenormService);
    regenerateForClub(clubId: string): Promise<string[]>;
}
