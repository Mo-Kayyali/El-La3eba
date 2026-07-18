import { PrismaService } from '../prisma/prisma.service';
export declare class SuggestionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAllSuggestions(filters?: {
        status?: 'PENDING' | 'APPROVED' | 'REJECTED';
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
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
            player: {
                id: string;
                createdAt: Date;
                name: string;
                createdBy: string | null;
                firstName: string;
                lastName: string;
                aliases: string[];
                nationality: string;
                dateOfBirth: Date | null;
                heightCm: number | null;
                preferredFoot: import(".prisma/client").$Enums.PreferredFoot | null;
                positions: import(".prisma/client").$Enums.Position[];
                primaryPosition: import(".prisma/client").$Enums.Position | null;
                isRetired: boolean;
                currentClubId: string | null;
                imageUrl: string | null;
                clubs: string[];
                competitions: string[];
            } | null;
            suggester: {
                id: string;
                email: string;
                username: string;
            };
        } & {
            id: string;
            questionId: string;
            guessText: string;
            playerId: string | null;
            suggestedBy: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            comment: string | null;
            reviewNote: string | null;
            createdAt: Date;
            reviewedAt: Date | null;
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    approveSuggestion(id: string, reviewNote?: string): Promise<{
        status: string;
        message: string;
        createdAnswer: boolean;
        suggestion: {
            id: string;
            questionId: string;
            guessText: string;
            playerId: string | null;
            suggestedBy: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            comment: string | null;
            reviewNote: string | null;
            createdAt: Date;
            reviewedAt: Date | null;
        };
    }>;
    rejectSuggestion(id: string, reviewNote?: string): Promise<{
        status: string;
        message: string;
        suggestion: {
            id: string;
            questionId: string;
            guessText: string;
            playerId: string | null;
            suggestedBy: string;
            status: import(".prisma/client").$Enums.SuggestionStatus;
            comment: string | null;
            reviewNote: string | null;
            createdAt: Date;
            reviewedAt: Date | null;
        };
    }>;
}
