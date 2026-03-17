import { PrismaService } from '../prisma/prisma.service';
export declare class GameService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    guessPlayer(guessName: string): Promise<any>;
}
