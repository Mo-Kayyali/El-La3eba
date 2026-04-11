import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { Server } from 'socket.io';
export type QueueMode = 'ranked' | 'unrated';
export declare class MatchmakingService {
    private readonly redisClient;
    private readonly prisma;
    private readonly logger;
    private server;
    private startTurnTimerFn?;
    private readonly QUEUES;
    constructor(redisClient: RedisService, prisma: PrismaService);
    setServer(server: Server): void;
    setTurnTimerStarter(fn: (gameSessionId: string) => void): void;
    joinQueue(userId: string, socketId: string, username: string | undefined, mode: QueueMode): Promise<void>;
    cancelSearch(userId: string): Promise<void>;
    private popValidPlayer;
    createPrivateRoom(userId: string, socketId: string, username?: string): Promise<string>;
    cancelPrivateRoom(userId: string): Promise<void>;
    private cleanupUserPrivateRoom;
    joinPrivateRoom(code: string, userId: string, socketId: string, username?: string): Promise<{
        success: boolean;
        error: string;
        gameSessionId?: undefined;
    } | {
        success: boolean;
        gameSessionId: `${string}-${string}-${string}-${string}-${string}`;
        error?: undefined;
    }>;
    handleMatchmakingInterval(): Promise<void>;
    private processQueue;
    initializeGameState(gameSessionId: string, player1Id: string, player2Id: string, player1Username?: string, player2Username?: string, isRanked?: boolean): Promise<{
        players: string[];
        currentTurn: string;
        playerNames: {
            [player1Id]: string;
            [player2Id]: string;
        };
        playerMmr: {
            [player1Id]: number;
            [player2Id]: number;
        };
        roundHistory: never[];
        scores: {
            [player1Id]: number;
            [player2Id]: number;
        };
        overallScores: {
            [player1Id]: number;
            [player2Id]: number;
        };
        currentRound: number;
        strikes: {
            [player1Id]: number;
            [player2Id]: number;
        };
        guessedPlayers: never[];
        currentQuestion: "Name a football player who played in 2026" | "Name a player who has won the Champions League" | "Name a player who has played in the Premier League" | "Name a player who has won the World Cup" | "Name a player who has won the Ballon d’Or" | "Name a player who has played for Barcelona" | "Name a player who has played for Real Madrid";
        isRanked: boolean;
    }>;
    updateMmrAfterMatch(winnerId: string, loserId: string): Promise<void>;
}
