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
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

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
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        console.log(
          `Connection rejected: Missing token for client ${client.id}`,
        );
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
      });

      // Attach user info to socket (optional, for later use)
      client.data.user = payload;
      console.log(
        `Client connected: ${client.id} (User ID: ${payload.sub || payload.userId})`,
      );
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

    const roomCode = await this.matchmakingService.createPrivateRoom(
      userId,
      client.id,
    );
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

    const result = await this.matchmakingService.joinPrivateRoom(
      roomCode,
      userId,
      client.id,
    );
    return result;
  }

  @SubscribeMessage('joinGameRoom')
  async handleJoinGameRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('gameSessionId') gameSessionId: string,
  ) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    if (!gameSessionId)
      return { status: 'error', message: 'gameSessionId required' };

    // 1. Put the new socket into the room
    client.join(gameSessionId);

    // 2. NEW: Fetch the current state from Redis and give it to the client immediately!
    try {
      const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
      if (stateStr) {
        // Send it ONLY to this specific client who just joined/reconnected
        client.emit('gameStateUpdated', { state: JSON.parse(stateStr) });
      }
    } catch (err) {
      this.logger.error(
        `Error fetching state for reconnecting client: ${err.message}`,
      );
    }

    return { status: 'success', message: `Joined room ${gameSessionId}` };
  }

  @SubscribeMessage('submitGuess')
  async handleSubmitGuess(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { gameSessionId: string; guessName: string },
  ) {
    try {
      this.logger.log(
        `Received guess from client ${client.id}: ${JSON.stringify(payload)}`,
      );

      const userId = client.data?.user?.sub || client.data?.user?.userId;
      if (!userId) {
        this.logger.error(`Unauthorized access attempt by client ${client.id}`);
        return { status: 'error', message: 'Unauthorized' };
      }

      const { gameSessionId, guessName } = payload;
      if (!gameSessionId || !guessName) {
        this.logger.error(`Missing gameSessionId or guessName in payload`);
        return {
          status: 'error',
          message: 'Missing gameSessionId or guessName',
        };
      }

      const key = `game:${gameSessionId}`;

      // Use WATCH for optimistic locking to prevent race conditions
      this.logger.log(
        `Starting Redis transaction for gameSessionId: ${gameSessionId}`,
      );
      await this.redisClient.watch(key);
      const stateStr = await this.redisClient.get(key);

      if (!stateStr) {
        await this.redisClient.unwatch();
        this.logger.error(`Game session not found: ${gameSessionId}`);
        return { status: 'error', message: 'Game session not found' };
      }

      const state = JSON.parse(stateStr);

      if (state.status === 'match_completed') {
        await this.redisClient.unwatch();
        this.logger.error(
          `Attempt to guess in completed match ${gameSessionId}`,
        );
        return { status: 'error', message: 'Match is already completed' };
      }

      if (state.currentTurn !== userId) {
        await this.redisClient.unwatch();
        this.logger.error(
          `User ${userId} attempted to guess out of turn. Current turn: ${state.currentTurn}`,
        );
        return { status: 'error', message: 'Not your turn' };
      }

      // Check DB for player
      this.logger.log(`Performing fuzzy search for guess: "${guessName}"`);
      const matchedPlayer = await this.gameService.guessPlayer(guessName);
      this.logger.log(`Fuzzy search complete. Match found: ${!!matchedPlayer}`);
      const isCorrect = !!matchedPlayer;

      if (isCorrect) {
        if (state.guessedPlayers.includes(matchedPlayer.name)) {
          await this.redisClient.unwatch();
          this.logger.error(
            `Player ${matchedPlayer.name} already guessed this round by user ${userId}`,
          );
          return {
            status: 'error',
            message: 'Player already guessed this round',
          };
        }
        state.guessedPlayers.push(matchedPlayer.name);
        state.scores[userId] += 1;
      } else {
        state.strikes[userId] += 1;
      }

      let isRoundOver = false;
      let isMatchOver = false;

      if (state.strikes[userId] >= 3) {
        isRoundOver = true;
        const otherPlayer =
          state.players.find((p: string) => p !== userId) || state.players[0];

        // Update overall scores
        state.overallScores[otherPlayer] += 1;

        if (state.overallScores[otherPlayer] >= 2 || state.currentRound >= 3) {
          isMatchOver = true;
          state.status = 'match_completed';
          state.winner =
            state.overallScores[state.players[0]] >
            state.overallScores[state.players[1]]
              ? state.players[0]
              : state.players[1];
        } else {
          // Match continues to next round
          state.currentRound += 1;
          state.scores = { [state.players[0]]: 0, [state.players[1]]: 0 };
          state.strikes = { [state.players[0]]: 0, [state.players[1]]: 0 };
          state.guessedPlayers = [];

          const questions = [
            'Name a football player who played in 2026',
            'Name a player who has won the Champions League',
            'Name a player who has played in the Premier League',
            'Name a player who has won the World Cup',
          ];
          state.currentQuestion =
            questions[(state.currentRound - 1) % questions.length];

          // Loser guesses first in the next round, so we don't change currentTurn (it's already userId)
          state.currentTurn = userId;
        }
      } else {
        const otherPlayer =
          state.players.find((p: string) => p !== userId) || state.players[0];
        state.currentTurn = otherPlayer;
      }

      // Execute transaction
      this.logger.log(`Executing Redis transaction to update state`);
      const multi = this.redisClient.multi();
      multi.set(key, JSON.stringify(state));
      const results = await multi.exec();

      if (!results) {
        this.logger.error(
          `Redis transaction failed (concurrent modification) for gameSessionId: ${gameSessionId}`,
        );
        return {
          status: 'error',
          message: 'Concurrent modification, try again',
        };
      }

      this.logger.log(
        `Redis transaction successful for gameSessionId: ${gameSessionId}`,
      );

      const updatePayload = {
        state,
        lastGuess: {
          user: userId,
          guess: guessName,
          correct: isCorrect,
          matchedName: isCorrect ? matchedPlayer.name : null,
        },
      };

      if (isMatchOver) {
        this.logger.log(`Broadcasting matchOver to room ${gameSessionId}`);
        this.server.to(gameSessionId).emit('matchOver', updatePayload);
      } else if (isRoundOver) {
        this.logger.log(
          `Broadcasting nextRoundStarted to room ${gameSessionId}`,
        );
        this.server.to(gameSessionId).emit('nextRoundStarted', updatePayload);
      } else {
        this.logger.log(
          `Broadcasting gameStateUpdated to room ${gameSessionId}`,
        );
        this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
      }

      return { status: 'success', isCorrect, matchedPlayer };
    } catch (error) {
      this.logger.error(
        `Exception in handleSubmitGuess: ${error.message}`,
        error.stack,
      );
      await this.redisClient.unwatch().catch(() => {});
      return { status: 'error', message: 'Internal server error' };
    }
  }
}
