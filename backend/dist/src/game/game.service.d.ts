import { PrismaService } from '../prisma/prisma.service';
import { GameMode, Question } from '@prisma/client';
export declare class GameService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    guessPlayer(guessName: string): Promise<any>;
    getRandomQuestion(gameMode?: GameMode, excludeIds?: string[]): Promise<Question | null>;
    validateAnswer(question: Question, player: any): Promise<boolean>;
    createSuggestion(userId: string, questionId: string, playerId: string, guessText: string, comment?: string): Promise<{
        status: string;
        message: string;
        suggestion?: undefined;
    } | {
        status: string;
        suggestion: {
            id: string;
            createdAt: Date;
            questionId: string;
            playerId: string;
            guessText: string;
            suggestedBy: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        };
        message?: undefined;
    }>;
}
