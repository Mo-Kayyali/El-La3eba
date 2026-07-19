import { SuggestionsService } from './suggestions.service';
export declare class SuggestionsController {
    private readonly suggestionsService;
    constructor(suggestionsService: SuggestionsService);
    getAllSuggestions(status?: 'PENDING' | 'APPROVED' | 'REJECTED', page?: string, limit?: string): Promise<{
        data: ({
            player: {
                id: string;
                createdAt: Date;
                name: string;
                clubs: string[];
                competitions: string[];
                createdBy: string | null;
                aliases: string[];
                firstName: string;
                lastName: string;
                nationality: string;
                dateOfBirth: Date | null;
                heightCm: number | null;
                preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
                positionCategories: import(".prisma/client").$Enums.PositionCategory[];
                positions: import(".prisma/client").$Enums.Position[];
                primaryPosition: import(".prisma/client").$Enums.Position | null;
                isRetired: boolean;
                currentClubId: string | null;
                imageUrl: string | null;
            } | null;
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
                createdBy: string | null;
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
            playerId: string | null;
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
            status: import(".prisma/client").$Enums.SuggestionStatus;
            questionId: string;
            playerId: string | null;
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
            status: import(".prisma/client").$Enums.SuggestionStatus;
            questionId: string;
            playerId: string | null;
            guessText: string;
            suggestedBy: string;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        };
    }>;
}
