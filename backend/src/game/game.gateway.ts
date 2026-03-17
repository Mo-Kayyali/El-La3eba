import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from './matchmaking.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly matchmakingService: MatchmakingService,
  ) {}

  afterInit(server: Server) {
    this.matchmakingService.setServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        console.log(`Connection rejected: Missing token for client ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
      });

      // Attach user info to socket (optional, for later use)
      client.data.user = payload;
      console.log(`Client connected: ${client.id} (User ID: ${payload.sub || payload.userId})`);
    } catch (error) {
      console.log(`Connection rejected: Invalid token for client ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (userId) {
      this.matchmakingService.leaveQueue(userId);
    }
  }

  @SubscribeMessage('joinQueue')
  async handleJoinQueue(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    await this.matchmakingService.joinQueue(userId, client.id);
    return { status: 'queued' };
  }

  @SubscribeMessage('createPrivateRoom')
  async handleCreatePrivateRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const roomCode = await this.matchmakingService.createPrivateRoom(userId, client.id);
    return { status: 'success', roomCode };
  }

  @SubscribeMessage('joinPrivateRoom')
  async handleJoinPrivateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('roomCode') roomCode: string,
  ) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    if (!roomCode) return { status: 'error', message: 'Room code required' };

    const result = await this.matchmakingService.joinPrivateRoom(roomCode, userId, client.id);
    return result;
  }
}
