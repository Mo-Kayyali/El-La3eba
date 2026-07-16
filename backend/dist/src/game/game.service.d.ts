import { PrismaService } from '../prisma/prisma.service';
import { GameMode, Question } from '@prisma/client';
export declare class GameService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    guessPlayer(guessName: string): Promise<any>;
    getRandomQuestion(gameMode?: GameMode, excludeIds?: string[]): Promise<Question | null>;
    validateAnswer(question: Question, player: any): Promise<boolean>;
}
