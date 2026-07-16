import { SuggestionsService } from './suggestions.service';
export declare class SuggestionsController {
    private readonly suggestionsService;
    constructor(suggestionsService: SuggestionsService);
    getAllSuggestions(status?: 'PENDING' | 'APPROVED' | 'REJECTED'): Promise<({
        question: {
            id: string;
            answerType: import(".prisma/client").$Enums.AnswerType;
            text: string;
            gameMode: import(".prisma/client").$Enums.GameMode;
            logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
            photoPlayerId: string | null;
            isActive: boolean;
            playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
            createdAt: Date;
            updatedAt: Date;
        };
        player: {
            id: string;
            name: string;
            clubs: string[];
            aliases: string[];
            competitions: string[];
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
        suggester: {
            id: string;
            email: string;
            username: string;
        };
    } & {
        id: string;
        questionId: string;
        playerId: string;
        createdAt: Date;
        guessText: string;
        suggestedBy: string;
        status: import(".prisma/client").$Enums.SuggestionStatus;
        comment: string | null;
        reviewNote: string | null;
        reviewedAt: Date | null;
    })[]>;
    approveSuggestion(id: string, body: {
        reviewNote?: string;
    }): Promise<{
        status: string;
        message: string;
        createdAnswer: boolean;
        suggestion: {
            id: string;
            questionId: string;
            playerId: string;
            createdAt: Date;
            guessText: string;
            suggestedBy: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
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
            questionId: string;
            playerId: string;
            createdAt: Date;
            guessText: string;
            suggestedBy: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            comment: string | null;
            reviewNote: string | null;
            reviewedAt: Date | null;
        };
    }>;
}
