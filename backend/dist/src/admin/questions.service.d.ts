import { PrismaService } from '../prisma/prisma.service';
import { GameMode, AnswerType, FilterType, LogicOperator, QuestionScope } from '@prisma/client';
export declare class QuestionAnswerDto {
    playerId: string;
    rank?: number;
    slotLabel?: string;
}
export declare class QuestionFilterClauseDto {
    filterType: FilterType;
    filterValue: string;
    timeframe?: 'CURRENT' | 'PAST' | 'BOTH';
}
export declare class CreateQuestionDto {
    text: string;
    gameMode: GameMode;
    scope: QuestionScope;
    answerType?: AnswerType;
    logicOperator?: LogicOperator;
    clauses?: QuestionFilterClauseDto[];
    photoPlayerId?: string;
    answers?: QuestionAnswerDto[];
    playerStatusFilter?: any;
    isActive?: boolean;
}
export declare class PatchQuestionDto extends CreateQuestionDto {
}
export declare class AdminQuestionsService {
    private prisma;
    constructor(prisma: PrismaService);
    validateShape(dto: CreateQuestionDto | PatchQuestionDto): Promise<{
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType | undefined;
        scope: any;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | undefined;
        answers: QuestionAnswerDto[];
        clauses: QuestionFilterClauseDto[];
    }>;
    create(createDto: CreateQuestionDto): Promise<{
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        id: string;
        text: string;
        scope: import(".prisma/client").$Enums.QuestionScope;
        isActive: boolean;
        playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(filters?: {
        gameMode?: GameMode;
        isActive?: boolean;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: ({
            clauses: {
                id: string;
                questionId: string;
                filterType: import(".prisma/client").$Enums.FilterType;
                filterValue: string;
                timeframe: import(".prisma/client").$Enums.Timeframe;
            }[];
            _count: {
                answers: number;
            };
        } & {
            gameMode: import(".prisma/client").$Enums.GameMode;
            answerType: import(".prisma/client").$Enums.AnswerType;
            logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
            photoPlayerId: string | null;
            id: string;
            text: string;
            scope: import(".prisma/client").$Enums.QuestionScope;
            isActive: boolean;
            playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
            createdAt: Date;
            updatedAt: Date;
        })[];
        meta: {
            total: number;
            page: number;
            totalPages: number;
        };
    }>;
    findOne(id: string): import(".prisma/client").Prisma.Prisma__QuestionClient<({
        answers: ({
            player: {
                name: string;
                aliases: string[];
                imageUrl: string | null;
            };
        } & {
            id: string;
            questionId: string;
            rank: number | null;
            playerId: string;
            slotLabel: string | null;
        })[];
        clauses: {
            id: string;
            questionId: string;
            filterType: import(".prisma/client").$Enums.FilterType;
            filterValue: string;
            timeframe: import(".prisma/client").$Enums.Timeframe;
        }[];
        photoPlayer: {
            name: string;
            imageUrl: string | null;
        } | null;
    } & {
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        id: string;
        text: string;
        scope: import(".prisma/client").$Enums.QuestionScope;
        isActive: boolean;
        playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        createdAt: Date;
        updatedAt: Date;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateDto: PatchQuestionDto): Promise<{
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        id: string;
        text: string;
        scope: import(".prisma/client").$Enums.QuestionScope;
        isActive: boolean;
        playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
