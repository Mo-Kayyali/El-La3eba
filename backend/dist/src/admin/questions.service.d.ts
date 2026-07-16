import { PrismaService } from '../prisma/prisma.service';
import { GameMode, AnswerType, FilterType } from '@prisma/client';
export declare class QuestionAnswerDto {
    playerId: string;
    rank?: number;
    slotLabel?: string;
}
export declare class CreateQuestionDto {
    text: string;
    gameMode: GameMode;
    answerType?: AnswerType;
    filterType?: FilterType;
    filterValue?: string;
    photoPlayerId?: string;
    answers?: QuestionAnswerDto[];
}
export declare class PatchQuestionDto extends CreateQuestionDto {
}
export declare class AdminQuestionsService {
    private prisma;
    constructor(prisma: PrismaService);
    validateShape(dto: CreateQuestionDto | PatchQuestionDto): Promise<{
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType | undefined;
        filterType: import(".prisma/client").$Enums.FilterType | undefined;
        filterValue: string | undefined;
        photoPlayerId: string | undefined;
        answers: QuestionAnswerDto[];
    }>;
    create(createDto: CreateQuestionDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType;
        filterType: import(".prisma/client").$Enums.FilterType | null;
        filterValue: string | null;
        photoPlayerId: string | null;
    }>;
    findAll(gameMode?: GameMode): import(".prisma/client").Prisma.PrismaPromise<({
        _count: {
            answers: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType;
        filterType: import(".prisma/client").$Enums.FilterType | null;
        filterValue: string | null;
        photoPlayerId: string | null;
    })[]>;
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
            playerId: string;
            rank: number | null;
            slotLabel: string | null;
        })[];
        photoPlayer: {
            name: string;
            imageUrl: string | null;
        } | null;
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType;
        filterType: import(".prisma/client").$Enums.FilterType | null;
        filterValue: string | null;
        photoPlayerId: string | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: string, updateDto: PatchQuestionDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        text: string;
        gameMode: import(".prisma/client").$Enums.GameMode;
        answerType: import(".prisma/client").$Enums.AnswerType;
        filterType: import(".prisma/client").$Enums.FilterType | null;
        filterValue: string | null;
        photoPlayerId: string | null;
    }>;
    remove(id: string): Promise<{
        success: boolean;
    }>;
}
