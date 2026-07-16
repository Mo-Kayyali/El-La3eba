import { AdminQuestionsService, CreateQuestionDto, PatchQuestionDto } from './questions.service';
import { GameMode } from '@prisma/client';
export declare class AdminQuestionsController {
    private readonly questionsService;
    constructor(questionsService: AdminQuestionsService);
    create(createDto: CreateQuestionDto): Promise<{
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findAll(gameMode?: GameMode): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            answers: number;
        };
        clauses: {
            id: string;
            questionId: string;
            filterType: import(".prisma/client").$Enums.FilterType;
            filterValue: string;
        }[];
    } & {
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
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
        }[];
        answers: ({
            player: {
                name: string;
                aliases: string[];
                imageUrl: string | null;
            };
        } & {
            id: string;
            questionId: string;
            playerId: string;
            rank: number | null;
            slotLabel: string | null;
        })[];
    } & {
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateDto: PatchQuestionDto): Promise<{
        id: string;
        answerType: import(".prisma/client").$Enums.AnswerType;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        logicOperator: import(".prisma/client").$Enums.LogicOperator | null;
        photoPlayerId: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
