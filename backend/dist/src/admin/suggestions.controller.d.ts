import { SuggestionsService } from './suggestions.service';
export declare class SuggestionsController {
    private readonly suggestionsService;
    constructor(suggestionsService: SuggestionsService);
    getAllSuggestions(status?: 'PENDING' | 'APPROVED' | 'REJECTED', page?: string, limit?: string): Promise<{
        data: ({
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
                scope: import(".prisma/client").$Enums.QuestionScope;
                answerType: import(".prisma/client").$Enums.AnswerType;
                logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
                photoPlayerId: string | null;
                playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
                isActive: boolean;
            };
            suggester: {
                id: string;
                email: string;
                username: string;
            };
        } & {
            id: string;
            createdAt: Date;
            playerId: string;
            questionId: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            guessText: string;
            suggestedBy: string;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    approveSuggestion(id: string, body: {
        reviewNote?: string;
    }): Promise<{
        status: string;
        message: string;
        createdAnswer: boolean;
        suggestion: {
            id: string;
            createdAt: Date;
            playerId: string;
            questionId: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            guessText: string;
            suggestedBy: string;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        };
    }>;
    rejectSuggestion(id: string, body: {
        reviewNote?: string;
    }): Promise<{
        status: string;
        message: string;
        suggestion: {
            id: string;
            createdAt: Date;
            playerId: string;
            questionId: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            guessText: string;
            suggestedBy: string;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        };
    }>;
}
