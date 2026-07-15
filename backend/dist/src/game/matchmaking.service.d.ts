import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { Server } from 'socket.io';
import type { ChainableCommander } from 'ioredis';
export type QueueMode = 'ranked' | 'unrated';
export declare class MatchmakingService {
    private readonly redisClient;
    private readonly prisma;
    private readonly logger;
    private server;
    private startTurnTimerFn?;
    private readonly roomExpiryTimers;
    private readonly SEARCH_TTL_SECONDS;
    private readonly PRIVATE_ROOM_TTL_SECONDS;
    private readonly ACTIVE_GAME_KEY_PREFIX;
    private readonly QUEUES;
    constructor(redisClient: RedisService, prisma: PrismaService);
    setServer(server: Server): void;
    setTurnTimerStarter(fn: (gameSessionId: string) => void): void;
    private queueSearchKey;
    private activeGameKey;
    private clearRoomExpiryTimer;
    private schedulePrivateRoomExpiry;
    joinQueue(userId: string, socketId: string, username: string | undefined, mode: QueueMode): Promise<void>;
    cancelSearch(userId: string): Promise<void>;
    private removeUserFromQueue;
    private purgeExpiredUsers;
    private popValidPlayerPair;
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
        winner: null;
        currentTurn: string;
        turnDeadlineAt: number;
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
    deleteActiveGameKeysInMulti(multi: ChainableCommander, playerIds: Array<string | number | undefined | null>): void;
    setActiveGameSessionIdInMulti(multi: ChainableCommander, userId: string, gameSessionId: string): void;
    setActiveGameSessionIdForUser(userId: string, gameSessionId: string): Promise<void>;
    getActiveGameSessionIdForUser(userId: string): Promise<string | null>;
    updateMmrAfterMatch(winnerId: string, loserId: string, options?: {
        marginMultiplier?: number;
    }): Promise<{
        winnerDelta: number;
        loserDelta: number;
    } | null>;
}
