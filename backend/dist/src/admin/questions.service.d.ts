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
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        scope: import(".prisma/client").$Enums.QuestionScope;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        isActive: boolean;
        playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(gameMode?: GameMode, isActive?: boolean): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            answers: number;
        };
        clauses: {
            id: string;
            questionId: string;
            filterType: import(".prisma/client").$Enums.FilterType;
            filterValue: string;
            timeframe: import(".prisma/client").$Enums.Timeframe;
        }[];
    } & {
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        scope: import(".prisma/client").$Enums.QuestionScope;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        isActive: boolean;
        playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findOne(id: string): import(".prisma/client").Prisma.Prisma__QuestionClient<({
        photoPlayer: {
            name: string;
            imageUrl: string | null;
        } | null;
        clauses: {
            id: string;
            questionId: string;
            filterType: import(".prisma/client").$Enums.FilterType;
            filterValue: string;
            timeframe: import(".prisma/client").$Enums.Timeframe;
        }[];
        answers: ({
            player: {
                name: string;
                aliases: string[];
                imageUrl: string | null;
            };
        } & {
            id: string;
            playerId: string;
            questionId: string;
            rank: number | null;
            slotLabel: string | null;
        })[];
    } & {
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        scope: import(".prisma/client").$Enums.QuestionScope;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        isActive: boolean;
        playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        createdAt: Date;
        updatedAt: Date;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateDto: PatchQuestionDto): Promise<{
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        scope: import(".prisma/client").$Enums.QuestionScope;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        isActive: boolean;
        playerStatusFilter: import(".prisma/client").$Enums.PlayerStatusFilter;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
