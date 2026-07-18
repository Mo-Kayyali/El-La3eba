import { PrismaService } from '../prisma/prisma.service';
export declare class SuggestionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllSuggestions(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<({
        player: {
            id: string;
            name: string;
            clubs: string[];
            competitions: string[];
            aliases: string[];
            firstName: string;
            lastName: string;
            nationality: string;
            dateOfBirth: Date | null;
            heightCm: number | null;
            preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
            positions: import(".prisma/client").$Enums.Position[];
            primaryPosition: import(".prisma/client").$Enums.Position | null;
            isRetired: boolean;
            currentClubId: string | null;
            imageUrl: string | null;
        };
        question: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            text: string;
            gameMode: import(".prisma/client").$Enums.GameMode;
            answerType: import(".prisma/client").$Enums.AnswerType;
            scope: import(".prisma/client").$Enums.QuestionScope;
            logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
            photoPlayerId: string | null;
            isActive: boolean;
            playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        };
        suggester: {
            id: string;
            email: string;
            username: string;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.SuggestionStatus;
        questionId: string;
        playerId: string;
        guessText: string;
        suggestedBy: string;
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
            status: import(".prisma/client").$Enums.SuggestionStatus;
            questionId: string;
            playerId: string;
            guessText: string;
            suggestedBy: string;
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
            status: import(".prisma/client").$Enums.SuggestionStatus;
            questionId: string;
            playerId: string;
            guessText: string;
            suggestedBy: string;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        };
    }>;
}
