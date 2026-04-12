import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from './matchmaking.service';
import type { QueueMode } from './matchmaking.service';
import { GameService } from './game.service';
import { RedisService } from '../redis/redis.service';
import { FriendsService } from '../friends/friends.service';
export declare class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    private readonly jwtService;
    private readonly matchmakingService;
    private readonly gameService;
    private readonly redisClient;
    private readonly friendsService;
    server: Server;
    private readonly logger;
    private readonly turnTimers;
    private readonly rematchTimers;
    private readonly disconnectTimers;
    private readonly guessTimestamps;
    private readonly roundTransitionMs;
    private readonly DISCONNECT_GRACE_MS;
    constructor(jwtService: JwtService, matchmakingService: MatchmakingService, gameService: GameService, redisClient: RedisService, friendsService: FriendsService);
    private sleep;
    private setPresenceOnline;
    private setPresenceInGame;
    private clearPresence;
    private emitFriendsPresenceSnapshot;
    broadcastFriendPresences(): Promise<void>;
    private resolveMmrDeltasForMatch;
    afterInit(server: Server): void;
    private isGuestRateLimited;
    private clearTurnTimer;
    private initializeRematch;
    private startRematchTimer;
    private clearRematchTimer;
    private disconnectTimerKey;
    private startDisconnectTimer;
    private clearDisconnectTimer;
    private startTurnTimer;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinQueue(client: Socket, mode?: QueueMode): Promise<{
        status: string;
        message: string;
        mode?: undefined;
    } | {
        status: string;
        mode: QueueMode;
        message?: undefined;
    }>;
    handleCancelSearch(client: Socket): Promise<{
        status: string;
        message: string;
    } | {
        status: string;
        message?: undefined;
    }>;
    handleCancelPrivateRoom(client: Socket): Promise<{
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
    handleInviteFriendToGame(client: Socket, friendId: string): Promise<{
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
    handleLeaveEndedMatch(client: Socket, gameSessionId: string): Promise<{
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
    handleForfeitMatch(client: Socket, gameSessionId: string): Promise<{
        status: string;
        message: string;
    } | {
        status: string;
        message?: undefined;
    }>;
}
