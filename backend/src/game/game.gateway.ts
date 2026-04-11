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
import type { QueueMode } from './matchmaking.service';
import { GameService } from './game.service';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { pickRandomFootballQuestion } from './game.questions';

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();
  private readonly rematchTimers = new Map<string, NodeJS.Timeout>();
  private readonly roundTransitionMs = 4000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly matchmakingService: MatchmakingService,
    private readonly gameService: GameService,
    private readonly redisClient: RedisService,
  ) {}

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  afterInit(server: Server) {
    this.matchmakingService.setServer(server);
    this.matchmakingService.setTurnTimerStarter(
      this.startTurnTimer.bind(this),
    );
  }

  private clearTurnTimer(gameSessionId: string) {
    const existing = this.turnTimers.get(gameSessionId);
    if (existing) {
      clearTimeout(existing);
      this.turnTimers.delete(gameSessionId);
    }
  }

  // ─── Rematch helpers ─────────────────────────────────────────────────────

  private async initializeRematch(gameSessionId: string, state: any) {
    const p1Id = String(state.players[0]);
    const p2Id = String(state.players[1]);
    const names = (state.playerNames ?? {}) as Record<string, string>;
    const p1Name = names[p1Id] ?? p1Id;
    const p2Name = names[p2Id] ?? p2Id;

    const rematchData = JSON.stringify({
      p1Id, p2Id, p1Name, p2Name, p1Ready: false, p2Ready: false,
    });
    // 35 s TTL — slightly longer than the 30 s app-level timer for safety.
    await this.redisClient.set(`rematch:${gameSessionId}`, rematchData, 'EX', 35);
    this.startRematchTimer(gameSessionId);
    this.logger.log(`Rematch window opened for game ${gameSessionId}`);
  }

  private startRematchTimer(gameSessionId: string) {
    this.clearRematchTimer(gameSessionId);
    const timeout = setTimeout(async () => {
      this.rematchTimers.delete(gameSessionId);
      await this.redisClient.del(`rematch:${gameSessionId}`).catch(() => {});
      this.server.to(gameSessionId).emit('rematchExpired');
      this.logger.log(`Rematch window expired for game ${gameSessionId}`);
    }, 30_000);
    this.rematchTimers.set(gameSessionId, timeout);
  }

  private clearRematchTimer(gameSessionId: string) {
    const existing = this.rematchTimers.get(gameSessionId);
    if (existing) {
      clearTimeout(existing);
      this.rematchTimers.delete(gameSessionId);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private startTurnTimer(gameSessionId: string) {
    this.clearTurnTimer(gameSessionId);

    const timeout = setTimeout(async () => {
      // Timer fired; remove it first to avoid duplicates on restart
      this.turnTimers.delete(gameSessionId);

      const key = `game:${gameSessionId}`;
      try {
        await this.redisClient.watch(key);
        const stateStr = await this.redisClient.get(key);
        if (!stateStr) {
          await this.redisClient.unwatch();
          return;
        }

        const state = JSON.parse(stateStr);

        if (state.status === 'match_completed') {
          await this.redisClient.unwatch();
          return;
        }

        const timedOutUserId = state.currentTurn;
        if (!timedOutUserId) {
          await this.redisClient.unwatch();
          return;
        }

        state.strikes[timedOutUserId] = (state.strikes[timedOutUserId] ?? 0) + 1;

        let isRoundOver = false;
        let isMatchOver = false;
        let roundWinner: string | null = null;

        if (state.strikes[timedOutUserId] >= 3) {
          isRoundOver = true;
          const otherPlayer =
            state.players.find((p: string) => p !== timedOutUserId) ||
            state.players[0];
          roundWinner = otherPlayer;

          // Record the round result snapshot for the Game Over history view
          if (!Array.isArray(state.roundHistory)) state.roundHistory = [];
          if (!state.roundHistory.some((r: any) => r?.round === state.currentRound)) {
            state.roundHistory.push({
              round: state.currentRound,
              winner: roundWinner,
              scores: { ...(state.scores ?? {}) },
            });
          }

          state.overallScores[otherPlayer] += 1;

          if (
            state.overallScores[otherPlayer] >= 2 ||
            state.currentRound >= 3
          ) {
            isMatchOver = true;
            state.status = 'match_completed';
            state.winner =
              state.overallScores[state.players[0]] >
              state.overallScores[state.players[1]]
                ? state.players[0]
                : state.players[1];
          } else {
            // Round over, but match continues: transition period.
            state.currentTurn = null;
          }
        } else {
          const otherPlayer =
            state.players.find((p: string) => p !== timedOutUserId) ||
            state.players[0];
          state.currentTurn = otherPlayer;
        }

        const multi = this.redisClient.multi();
        multi.set(key, JSON.stringify(state));
        const results = await multi.exec();

        if (!results) {
          // Concurrent modification; try again next turn tick.
          this.startTurnTimer(gameSessionId);
          return;
        }

        const updatePayload = {
          state,
          lastGuess: {
            user: timedOutUserId,
            guess: null,
            correct: false,
            matchedName: null,
            reason: 'timeout',
          },
        };

        // Requirement: always broadcast gameStateUpdated from timer callback
        this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);

        if (isMatchOver) {
          this.server.to(gameSessionId).emit('matchOver', updatePayload);
          this.clearTurnTimer(gameSessionId);
          if (state.isRanked && state.winner) {
            const loserId = state.players.find((p: string) => p !== state.winner) as string;
            this.matchmakingService
              .updateMmrAfterMatch(state.winner, loserId)
              .catch((e) => this.logger.error(`MMR update failed: ${e?.message}`));
          }
          this.initializeRematch(gameSessionId, state).catch((e) =>
            this.logger.error(`initializeRematch failed: ${e?.message}`),
          );
        } else if (isRoundOver) {
          this.server.to(gameSessionId).emit('roundOver', {
            winner: roundWinner,
            nextRoundIn: this.roundTransitionMs / 1000,
          });

          await this.sleep(this.roundTransitionMs);

          // Start next round after transition, with optimistic locking.
          await this.redisClient.watch(key);
          const latestStr = await this.redisClient.get(key);
          if (!latestStr) {
            await this.redisClient.unwatch();
            return;
          }
          const latest = JSON.parse(latestStr);
          if (latest.status === 'match_completed') {
            await this.redisClient.unwatch();
            return;
          }

          latest.currentRound += 1;
          latest.scores = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
          latest.strikes = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
          latest.guessedPlayers = [];
          latest.currentQuestion = pickRandomFootballQuestion();
          // Alternate Round starters (BO3): R1 players[0], R2 players[1], R3 players[0]
          if (latest.currentRound === 2) latest.currentTurn = latest.players[1];
          else if (latest.currentRound === 3) latest.currentTurn = latest.players[0];
          else latest.currentTurn = latest.players[0];

          const multi2 = this.redisClient.multi();
          multi2.set(key, JSON.stringify(latest));
          const results2 = await multi2.exec();
          if (!results2) {
            this.startTurnTimer(gameSessionId);
            return;
          }

          const nextPayload = { state: latest, lastGuess: updatePayload.lastGuess };
          this.server.to(gameSessionId).emit('nextRoundStarted', nextPayload);
          this.startTurnTimer(gameSessionId);
        } else {
          this.startTurnTimer(gameSessionId);
        }
      } catch (error) {
        this.logger.error(
          `Exception in turn timer for ${gameSessionId}: ${error.message}`,
          error.stack,
        );
      } finally {
        await this.redisClient.unwatch().catch(() => {});
      }
    }, 10_000);

    this.turnTimers.set(gameSessionId, timeout);
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

  async handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (userId) {
      // Best-effort cleanup — fire-and-forget is fine on disconnect
      this.matchmakingService.cancelSearch(userId).catch(() => {});
      this.matchmakingService.cancelPrivateRoom(userId).catch(() => {});
    }

    // Clear any per-session timers for rooms this socket was in
    try {
      const rooms = Array.from(client.rooms ?? []);
      for (const room of rooms) {
        if (room && room !== client.id) this.clearTurnTimer(room);
      }
    } catch {
      // ignore
    }
  }

  @SubscribeMessage('joinQueue')
  async handleJoinQueue(
    @ConnectedSocket() client: Socket,
    @MessageBody('mode') mode: QueueMode = 'ranked',
  ) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const resolvedMode: QueueMode =
      mode === 'ranked' || mode === 'unrated' ? mode : 'ranked';

    const username =
      client.data?.user?.username ||
      client.data?.user?.name ||
      client.data?.user?.email;

    await this.matchmakingService.joinQueue(userId, client.id, username, resolvedMode);
    return { status: 'queued', mode: resolvedMode };
  }

  @SubscribeMessage('cancelSearch')
  async handleCancelSearch(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    await this.matchmakingService.cancelSearch(userId);
    return { status: 'ok' };
  }

  @SubscribeMessage('cancelPrivateRoom')
  async handleCancelPrivateRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    await this.matchmakingService.cancelPrivateRoom(userId);
    return { status: 'ok' };
  }

  @SubscribeMessage('createPrivateMatch')
  async handleCreatePrivateRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const username =
      client.data?.user?.username ||
      client.data?.user?.name ||
      client.data?.user?.email;

    const roomCode = await this.matchmakingService.createPrivateRoom(
      userId,
      client.id,
      username,
    );
    return { status: 'success', roomCode };
  }

  @SubscribeMessage('joinPrivateMatch')
  async handleJoinPrivateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('roomCode') roomCode: string,
  ) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    if (!roomCode) return { status: 'error', message: 'Room code required' };

    const username =
      client.data?.user?.username ||
      client.data?.user?.name ||
      client.data?.user?.email;

    const result = await this.matchmakingService.joinPrivateRoom(
      roomCode,
      userId,
      client.id,
      username,
    );
    return result;
  }

  @SubscribeMessage('requestRematch')
  async handleRequestRematch(
    @ConnectedSocket() client: Socket,
    @MessageBody('gameSessionId') gameSessionId: string,
  ) {
    const userId = String(client.data?.user?.sub || client.data?.user?.userId || '');
    if (!userId || !gameSessionId) {
      return { status: 'error', message: 'Invalid request' };
    }

    const rematchKey = `rematch:${gameSessionId}`;
    try {
      await this.redisClient.watch(rematchKey);
      const rematchStr = await this.redisClient.get(rematchKey);

      if (!rematchStr) {
        await this.redisClient.unwatch();
        return { status: 'error', message: 'Rematch window has expired' };
      }

      const rematch = JSON.parse(rematchStr) as {
        p1Id: string; p2Id: string; p1Name: string; p2Name: string;
        p1Ready: boolean; p2Ready: boolean;
      };

      if (rematch.p1Id === userId) {
        rematch.p1Ready = true;
      } else if (rematch.p2Id === userId) {
        rematch.p2Ready = true;
      } else {
        await this.redisClient.unwatch();
        return { status: 'error', message: 'Not a player in this game' };
      }

      // Atomically persist the updated readiness via WATCH + MULTI/EXEC.
      const multi = this.redisClient.multi();
      multi.set(rematchKey, JSON.stringify(rematch), 'EX', 35);
      const results = await multi.exec();

      if (!results) {
        // Another request modified the key between WATCH and EXEC — ask client to retry.
        return { status: 'retry', message: 'Concurrent update, please try again' };
      }

      // Tell everyone in the room that this player wants to rematch.
      this.server.to(gameSessionId).emit('rematchRequested', { userId });

      if (rematch.p1Ready && rematch.p2Ready) {
        // Both accepted — start a brand-new game for them.
        this.clearRematchTimer(gameSessionId);
        await this.redisClient.del(rematchKey);

        const newGameSessionId = randomUUID();
        const newState = await this.matchmakingService.initializeGameState(
          newGameSessionId,
          rematch.p1Id,
          rematch.p2Id,
          rematch.p1Name,
          rematch.p2Name,
        );

        // Move all sockets still in the old room into the new one.
        this.server.in(gameSessionId).socketsJoin(newGameSessionId);
        this.server.to(gameSessionId).emit('rematchStarting', { newGameSessionId });
        this.server.to(newGameSessionId).emit('gameStateUpdated', { state: newState });
        this.startTurnTimer(newGameSessionId);

        this.logger.log(`Rematch started: ${newGameSessionId} (from ${gameSessionId})`);
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(`Error in requestRematch: ${error?.message}`, error?.stack);
      return { status: 'error', message: 'Internal server error' };
    } finally {
      await this.redisClient.unwatch().catch(() => {});
    }
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
    this.logger.log(
      `User ${userId} joined game room ${gameSessionId} (socket ${client.id})`,
    );

    // 2. NEW: Fetch the current state from Redis and give it to the client immediately!
    try {
      const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
      if (stateStr) {
        // Send it ONLY to this specific client who just joined/reconnected.
        // Frontend expects the raw game state object.
        client.emit('gameStateUpdated', JSON.parse(stateStr));
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
      // A guess submission stops the current turn timer immediately.
      this.clearTurnTimer(gameSessionId);

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
      let isCorrect = !!matchedPlayer;

      if (isCorrect) {
        if (state.guessedPlayers.some((g: any) => (typeof g === 'string' ? g : g?.name) === matchedPlayer.name)) {
          // Penalty: treat already-guessed as a WRONG answer (strike) and proceed normally.
          isCorrect = false;
          state.strikes[userId] += 1;
        } else {
          state.guessedPlayers.push({ name: matchedPlayer.name, guessedBy: userId });
          state.scores[userId] += 1;
        }
      } else {
        state.strikes[userId] += 1;
      }

      let isRoundOver = false;
      let isMatchOver = false;
      let roundWinner: string | null = null;

      if (state.strikes[userId] >= 3) {
        isRoundOver = true;
        const otherPlayer =
          state.players.find((p: string) => p !== userId) || state.players[0];
        roundWinner = otherPlayer;

        // Record the round result snapshot for the Game Over history view
        if (!Array.isArray(state.roundHistory)) state.roundHistory = [];
        if (!state.roundHistory.some((r: any) => r?.round === state.currentRound)) {
          state.roundHistory.push({
            round: state.currentRound,
            winner: roundWinner,
            scores: { ...(state.scores ?? {}) },
          });
        }

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
          // Round ends, but match continues: transition period.
          state.currentTurn = null;
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
        // Restart timer for whoever currently has the turn (best-effort).
        this.startTurnTimer(gameSessionId);
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
        this.clearTurnTimer(gameSessionId);
        if (state.isRanked && state.winner) {
          const loserId = state.players.find((p: string) => p !== state.winner) as string;
          this.matchmakingService
            .updateMmrAfterMatch(state.winner, loserId)
            .catch((e) => this.logger.error(`MMR update failed: ${e?.message}`));
        }
        this.initializeRematch(gameSessionId, state).catch((e) =>
          this.logger.error(`initializeRematch failed: ${e?.message}`),
        );
      } else if (isRoundOver) {
        this.logger.log(`Broadcasting roundOver to room ${gameSessionId}`);
        this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
        this.server.to(gameSessionId).emit('roundOver', {
          winner: roundWinner,
          nextRoundIn: this.roundTransitionMs / 1000,
        });

        await this.sleep(this.roundTransitionMs);

        // Start next round after transition, with optimistic locking.
        await this.redisClient.watch(key);
        const latestStr = await this.redisClient.get(key);
        if (!latestStr) {
          await this.redisClient.unwatch();
          return { status: 'error', message: 'Game session not found' };
        }
        const latest = JSON.parse(latestStr);

        if (latest.status === 'match_completed') {
          await this.redisClient.unwatch();
          return { status: 'success', isCorrect, matchedPlayer };
        }

        latest.currentRound += 1;
        latest.scores = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
        latest.strikes = { [latest.players[0]]: 0, [latest.players[1]]: 0 };
        latest.guessedPlayers = [];
        latest.currentQuestion = pickRandomFootballQuestion();
        // Alternate Round starters (BO3): R1 players[0], R2 players[1], R3 players[0]
        if (latest.currentRound === 2) latest.currentTurn = latest.players[1];
        else if (latest.currentRound === 3) latest.currentTurn = latest.players[0];
        else latest.currentTurn = latest.players[0];

        const multi2 = this.redisClient.multi();
        multi2.set(key, JSON.stringify(latest));
        const results2 = await multi2.exec();

        if (!results2) {
          await this.redisClient.unwatch().catch(() => {});
          this.startTurnTimer(gameSessionId);
          return {
            status: 'error',
            message: 'Concurrent modification, try again',
          };
        }
        await this.redisClient.unwatch().catch(() => {});

        const nextPayload = {
          state: latest,
          lastGuess: updatePayload.lastGuess,
        };

        this.logger.log(
          `Broadcasting nextRoundStarted to room ${gameSessionId}`,
        );
        this.server.to(gameSessionId).emit('nextRoundStarted', nextPayload);
        this.startTurnTimer(gameSessionId);
      } else {
        this.logger.log(
          `Broadcasting gameStateUpdated to room ${gameSessionId}`,
        );
        this.server.to(gameSessionId).emit('gameStateUpdated', updatePayload);
        this.startTurnTimer(gameSessionId);
      }

      return { status: 'success', isCorrect, matchedPlayer };
    } catch (error) {
      this.logger.error(
        `Exception in handleSubmitGuess: ${error.message}`,
        error.stack,
      );
      await this.redisClient.unwatch().catch(() => {});
      if (payload?.gameSessionId) this.startTurnTimer(payload.gameSessionId);
      return { status: 'error', message: 'Internal server error' };
    }
  }
}
