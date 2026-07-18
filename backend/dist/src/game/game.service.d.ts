import { PrismaService } from '../prisma/prisma.service';
import { GameMode, Question } from '@prisma/client';
export declare class GameService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    guessPlayer(guessName: string): Promise<any[]>;
    getRandomQuestion(gameMode?: GameMode, excludeIds?: string[]): Promise<Question | null>;
    validateAnswer(question: Question & {
        playerStatusFilter?: string;
    }, player: any): Promise<boolean>;
    createSuggestion(userId: string, questionId: string, playerId: string | null, guessText: string, comment?: string): Promise<{
        status: string;
        message: string;
        suggestion?: undefined;
    } | {
        status: string;
        suggestion: {
            id: string;
            guessText: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            comment: string | null;
            reviewNote: string | null;
            createdAt: Date;
            reviewedAt: Date | null;
            questionId: string;
            playerId: string | null;
            suggestedBy: string;
        };
        message?: undefined;
    }>;
}
