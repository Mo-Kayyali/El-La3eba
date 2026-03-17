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
import { GameService } from './game.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly matchmakingService: MatchmakingService,
    private readonly gameService: GameService,
    private readonly redisClient: RedisService,
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

  @SubscribeMessage('submitGuess')
  async handleSubmitGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameSessionId: string; guessName: string },
  ) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const { gameSessionId, guessName } = payload;
    if (!gameSessionId || !guessName) {
      return { status: 'error', message: 'Missing gameSessionId or guessName' };
    }

    const key = `game:${gameSessionId}`;

    // Use WATCH for optimistic locking to prevent race conditions
    await this.redisClient.watch(key);
    const stateStr = await this.redisClient.get(key);

    if (!stateStr) {
      await this.redisClient.unwatch();
      return { status: 'error', message: 'Game session not found' };
    }

    const state = JSON.parse(stateStr);

    if (state.currentTurn !== userId) {
      await this.redisClient.unwatch();
      return { status: 'error', message: 'Not your turn' };
    }

    // Check DB for player
    const matchedPlayer = await this.gameService.guessPlayer(guessName);
    const isCorrect = !!matchedPlayer;

    if (isCorrect) {
      if (state.guessedPlayers.includes(matchedPlayer.name)) {
        await this.redisClient.unwatch();
        return { status: 'error', message: 'Player already guessed this round' };
      }
      state.guessedPlayers.push(matchedPlayer.name);
      state.scores[userId] += 1;
    } else {
      state.strikes[userId] += 1;
    }

    const otherPlayer = state.players.find(p => p !== userId) || state.players[0];
    state.currentTurn = otherPlayer;

    // Execute transaction
    const multi = this.redisClient.multi();
    multi.set(key, JSON.stringify(state));
    const results = await multi.exec();

    if (!results) {
      return { status: 'error', message: 'Concurrent modification, try again' };
    }

    // Emit updated state to the clients
    // (In a real app, we need to store gameSessionId -> room/sockets binding or use Redis Pub/Sub,
    // here we can just broadcast or emit to the specific users involved)
    
    // We don't have socket IDs directly stored in the game state right now to .to(socketId).
    // Let's rely on standard socket.io room features if we make them join a room, but currently 
    // Matchmaking emits directly to socket IDs.
    // For now we will broadcast to everyone in a room named gameSessionId.
    // Wait, let's make users join the socket.io room when match is found.
    this.server.to(gameSessionId).emit('gameStateUpdated', { state, lastGuess: { user: userId, guess: guessName, correct: isCorrect, matchedName: isCorrect ? matchedPlayer.name : null } });

    return { status: 'success', isCorrect, matchedPlayer };
  }
}
