import { AdminQuestionsService, CreateQuestionDto, PatchQuestionDto } from './questions.service';
import { GameMode } from '@prisma/client';
import { GameService } from '../game/game.service';
export declare class AdminQuestionsController {
    private readonly questionsService;
    private readonly gameService;
    constructor(questionsService: AdminQuestionsService, gameService: GameService);
    create(createDto: CreateQuestionDto): Promise<{
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
    }>;
    findAll(gameMode?: GameMode, isActive?: string): import(".prisma/client").Prisma.PrismaPromise<({
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
            questionId: string;
            playerId: string;
            rank: number | null;
            slotLabel: string | null;
        })[];
    } & {
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateDto: PatchQuestionDto): Promise<{
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
