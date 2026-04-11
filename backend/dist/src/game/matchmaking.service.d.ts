import { RedisService } from '../redis/redis.service';
import { Server } from 'socket.io';
export declare class MatchmakingService {
    private readonly redisClient;
    private readonly logger;
    private server;
    private startTurnTimerFn?;
    constructor(redisClient: RedisService);
    setServer(server: Server): void;
    setTurnTimerStarter(fn: (gameSessionId: string) => void): void;
    joinQueue(userId: string, socketId: string, username?: string): Promise<void>;
    leaveQueue(userId: string): Promise<void>;
    handleMatchmakingInterval(): Promise<void>;
    createPrivateRoom(userId: string, socketId: string, username?: string): Promise<string>;
    joinPrivateRoom(code: string, userId: string, socketId: string, username?: string): Promise<{
        success: boolean;
        error: string;
        gameSessionId?: undefined;
    } | {
        success: boolean;
        gameSessionId: `${string}-${string}-${string}-${string}-${string}`;
        error?: undefined;
    }>;
    initializeGameState(gameSessionId: string, player1Id: string, player2Id: string, player1Username?: string, player2Username?: string): Promise<{
        players: string[];
        currentTurn: string;
        playerNames: {
            [player1Id]: string;
            [player2Id]: string;
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
    }>;
}
