import { PrismaService } from '../prisma/prisma.service';
export declare class SuggestionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPendingSuggestions(): Promise<({
        player: {
            id: string;
            name: string;
            clubs: string[];
            nationality: string;
            firstName: string;
            lastName: string;
            isRetired: boolean;
            currentClubId: string | null;
            aliases: string[];
            competitions: string[];
            dateOfBirth: Date | null;
            heightCm: number | null;
            preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
            positions: import(".prisma/client").$Enums.Position[];
            primaryPosition: import(".prisma/client").$Enums.Position | null;
            imageUrl: string | null;
        };
        question: {
            id: string;
            answerType: import(".prisma/client").$Enums.AnswerType;
            text: string;
            gameMode: import(".prisma/client").$Enums.GameMode;
            logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
            photoPlayerId: string | null;
            createdAt: Date;
            updatedAt: Date;
        };
        suggester: {
            id: string;
            email: string;
            username: string;
        };
    } & {
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
    })[]>;
    approveSuggestion(id: string, reviewNote?: string): Promise<{
        status: string;
        message: string;
        createdAnswer: boolean;
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
    }>;
    rejectSuggestion(id: string, reviewNote?: string): Promise<{
        status: string;
        message: string;
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
    }>;
}
