import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from './matchmaking.service';
export declare class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
    private readonly jwtService;
    private readonly matchmakingService;
    server: Server;
    constructor(jwtService: JwtService, matchmakingService: MatchmakingService);
    afterInit(server: Server): void;
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): void;
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
}
