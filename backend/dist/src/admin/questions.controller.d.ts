import { AdminQuestionsService, CreateQuestionDto, PatchQuestionDto } from './questions.service';
import { GameMode } from '@prisma/client';
import { GameService } from '../game/game.service';
export declare class AdminQuestionsController {
    private readonly questionsService;
    private readonly gameService;
    constructor(questionsService: AdminQuestionsService, gameService: GameService);
    create(createDto: CreateQuestionDto, req: any): Promise<{
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
        createdBy: string | null;
    }>;
    findAll(gameMode?: GameMode, isActive?: string, search?: string, page?: string, limit?: string, sort?: string, order?: string): Promise<{
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
            createdBy: string | null;
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
        createdBy: string | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateDto: PatchQuestionDto, req: any): Promise<{
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
        createdBy: string | null;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
    testGuess(id: string, guessName: string): Promise<{
        error: string;
        matchedPlayer?: undefined;
        isCorrect?: undefined;
    } | {
        matchedPlayer: null;
        isCorrect: boolean;
        error?: undefined;
    }>;
}
