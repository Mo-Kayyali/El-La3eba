import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from './matchmaking.service';
import { GameService } from './game.service';
import { RedisService } from '../redis/redis.service';
export declare class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    private readonly jwtService;
    private readonly matchmakingService;
    private readonly gameService;
    private readonly redisClient;
    server: Server;
    private readonly logger;
    private readonly turnTimers;
    private readonly rematchTimers;
    private readonly roundTransitionMs;
    constructor(jwtService: JwtService, matchmakingService: MatchmakingService, gameService: GameService, redisClient: RedisService);
    private sleep;
    afterInit(server: Server): void;
    private clearTurnTimer;
    private initializeRematch;
    private startRematchTimer;
    private clearRematchTimer;
    private startTurnTimer;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinQueue(client: Socket): Promise<{
        status: string;
        message: string;
    } | {
        status: string;
        message?: undefined;
    }>;
    handleCreatePrivateRoom(client: Socket): Promise<{
        status: string;
        message: string;
        roomCode?: undefined;
    } | {
        status: string;
        roomCode: string;
        message?: undefined;
    }>;
    handleJoinPrivateRoom(client: Socket, roomCode: string): Promise<{
        success: boolean;
        error: string;
        gameSessionId?: undefined;
    } | {
        success: boolean;
        gameSessionId: `${string}-${string}-${string}-${string}-${string}`;
        error?: undefined;
    } | {
        status: string;
        message: string;
    }>;
    handleRequestRematch(client: Socket, gameSessionId: string): Promise<{
        status: string;
        message: string;
    } | {
        status: string;
        message?: undefined;
    }>;
    handleJoinGameRoom(client: Socket, gameSessionId: string): Promise<{
        status: string;
        message: string;
    }>;
    handleSubmitGuess(client: Socket, payload: {
        gameSessionId: string;
        guessName: string;
    }): Promise<{
        status: string;
        message: string;
        isCorrect?: undefined;
        matchedPlayer?: undefined;
    } | {
        status: string;
        isCorrect: boolean;
        matchedPlayer: any;
        message?: undefined;
    }>;
}
