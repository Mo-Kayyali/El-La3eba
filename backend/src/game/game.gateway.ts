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
import { Interval } from '@nestjs/schedule';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MatchmakingService } from './matchmaking.service';
import type { QueueMode } from './matchmaking.service';
import { GameService } from './game.service';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { pickRandomFootballQuestion } from './game.questions';
import { scoreMarginMultiplier } from './elo.util';
import { FriendsService } from '../friends/friends.service';

// ─── In-gateway sliding-window rate limiter ────────────────────────────────
// Limits submitGuess to MAX_GUESSES_PER_WINDOW per user per WINDOW_MS.
// This runs in-process (no extra dependency) and is reset on server restart,
// which is acceptable — the goal is to stop DDoS bursts, not persistent abuse.
const GUESS_RATE_LIMIT_MAX = 5;
const GUESS_RATE_LIMIT_WINDOW_MS = 1000; // 1 second
// ─────────────────────────────────────────────────────────────────────────────

@WebSocketGateway({ cors: { origin: '*' } })
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  /** Turn timers keyed by gameSessionId. */
  private readonly turnTimers = new Map<string, NodeJS.Timeout>();

  /** Rematch countdown timers keyed by gameSessionId. */
  private readonly rematchTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Reconnection grace-period timers.
   * Key: `${gameSessionId}:${userId}` — avoids collisions when both players drop.
   */
  private readonly disconnectTimers = new Map<string, NodeJS.Timeout>();

  /**
   * Rate-limiter state: userId → sorted array of timestamp (ms) of recent guesses.
   * Entries older than GUESS_RATE_LIMIT_WINDOW_MS are pruned on each check.
   */
  private readonly guessTimestamps = new Map<string, number[]>();

  private readonly roundTransitionMs = 4000;

  /** Disconnect grace period before a forfeit is issued (ms). */
  private readonly DISCONNECT_GRACE_MS = 15_000;
  private readonly INVITE_COOLDOWN_SECONDS = 5;
  private readonly INVITE_TTL_SECONDS = 60;

  constructor(
    private readonly jwtService: JwtService,
    private readonly matchmakingService: MatchmakingService,
    private readonly gameService: GameService,
    private readonly redisClient: RedisService,
    private readonly friendsService: FriendsService,
  ) {}

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private inviteCooldownKey(inviterId: string) {
    return `game_invite_cooldown:${inviterId}`;
  }

  private inviteKey(inviterId: string, inviteeId: string) {
    return `game_invite:${inviterId}:${inviteeId}`;
  }

  private async cancelActiveInvitesByInviter(
    inviterId: string,
    reason: 'inviter_offline' | 'inviter_in_game',
  ) {
    const keys = await this.redisClient
      .keys(this.inviteKey(inviterId, '*'))
      .catch(() => [] as string[]);
    if (!keys.length) return;

    const values = await this.redisClient.mget(...keys);
    const invitees: string[] = [];

    values.forEach((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { inviteeId?: string };
        if (parsed?.inviteeId) invitees.push(parsed.inviteeId);
      } catch {
        // Ignore malformed payloads and continue cleanup.
      }
    });

    await this.redisClient.del(...keys).catch(() => 0);
    await this.matchmakingService.cancelPrivateRoom(inviterId).catch(() => {});

    invitees.forEach((inviteeId) => {
      this.server.to(inviteeId).emit('inviteCancelledBySystem', {
        inviterId,
        inviteeId,
        reason,
      });
    });
  }

  public emitFriendRequestReceived(
    recipientId: string,
    payload: {
      requestId: string;
      senderId: string;
      senderUsername: string;
      createdAt: string;
    },
  ) {
    if (!this.server) return;
    const room = this.server.sockets.adapter.rooms.get(recipientId);
    if (!room || room.size === 0) return;
    this.server.to(recipientId).emit('friendRequestReceived', payload);
  }

  private async setPresenceOnline(userId: string) {
    await this.redisClient.hset('presence', userId, 'online');
  }

  private async setPresenceInGame(userId: string, gameSessionId: string) {
    await this.redisClient.hset('presence', userId, `in-game:${gameSessionId}`);
  }

  private async clearPresence(userId: string) {
    await this.redisClient.hdel('presence', userId);
  }

  private async emitFriendsPresenceSnapshot(userId: string) {
    if (!this.server) return;
    const friends = await this.friendsService.getFriendPresenceSnapshot(userId);
    this.server.to(userId).emit('friendsPresenceUpdated', { friends });
  }

  @Interval(5000)
  async broadcastFriendPresences() {
    if (!this.server) return;

    const userIds = await this.redisClient
      .hkeys('presence')
      .catch(() => [] as string[]);
    if (!userIds.length) return;

    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const friends =
            await this.friendsService.getFriendPresenceSnapshot(userId);
          this.server.to(userId).emit('friendsPresenceUpdated', { friends });
        } catch (error) {
          this.logger.warn(
            `Presence broadcast skipped for ${userId}: ${(error as Error)?.message}`,
          );
        }
      }),
    );
  }

  /**
   * Ranked-only: persists MMR (with margin / forfeit rules) and returns per-user deltas for clients.
   */
  private async resolveMmrDeltasForMatch(
    state: any,
    winnerId: string,
    loserId: string,
    forfeited: boolean,
  ): Promise<Record<string, number> | undefined> {
    if (!state?.isRanked || !winnerId || !loserId) return undefined;
    const w = Number(state.overallScores?.[winnerId] ?? 0);
    const l = Number(state.overallScores?.[loserId] ?? 0);
    const margin = forfeited ? 1.2 : scoreMarginMultiplier(w, l);
    const res = await this.matchmakingService.updateMmrAfterMatch(
      winnerId,
      loserId,
      {
        marginMultiplier: margin,
      },
    );
    if (!res) return undefined;
    return { [winnerId]: res.winnerDelta, [loserId]: res.loserDelta };
  }

  afterInit(server: Server) {
    this.matchmakingService.setServer(server);
    this.matchmakingService.setTurnTimerStarter(this.startTurnTimer.bind(this));
  }

  // ─── Rate limiter ─────────────────────────────────────────────────────────

  /**
   * Returns true if the user has exceeded the guess rate limit.
   * Prunes stale timestamps as a side-effect to keep the Map compact.
   */
  private isGuestRateLimited(userId: string): boolean {
    const now = Date.now();
    const recent = (this.guessTimestamps.get(userId) ?? []).filter(
      (t) => now - t < GUESS_RATE_LIMIT_WINDOW_MS,
    );
    if (recent.length >= GUESS_RATE_LIMIT_MAX) {
      this.guessTimestamps.set(userId, recent);
      return true;
    }
    recent.push(now);
    this.guessTimestamps.set(userId, recent);
    return false;
  }

  // ─── Turn timer ───────────────────────────────────────────────────────────

  private clearTurnTimer(gameSessionId: string) {
    const existing = this.turnTimers.get(gameSessionId);
    if (existing) {
      clearTimeout(existing);
      this.turnTimers.delete(gameSessionId);
    }
  }

  // ─── Rematch helpers ──────────────────────────────────────────────────────

  private async initializeRematch(gameSessionId: string, state: any) {
    const p1Id = String(state.players[0]);
    const p2Id = String(state.players[1]);
    const names = (state.playerNames ?? {}) as Record<string, string>;
    const p1Name = names[p1Id] ?? p1Id;
    const p2Name = names[p2Id] ?? p2Id;

    const rematchData = JSON.stringify({
      p1Id,
      p2Id,
      p1Name,
      p2Name,
      p1Ready: false,
      p2Ready: false,
      isRanked: !!state.isRanked,
    });
    // 35 s TTL — slightly longer than the 30 s app-level timer for safety.
    await this.redisClient.set(
      `rematch:${gameSessionId}`,
      rematchData,
      'EX',
      35,
    );
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

  // ─── Reconnection helpers ─────────────────────────────────────────────────

  private disconnectTimerKey(gameSessionId: string, userId: string) {
    return `${gameSessionId}:${userId}`;
  }

  /**
   * Starts the 15-second reconnection grace timer for a disconnected player.
   * If the timer fires the game is forfeited for that player.
   * If the player reconnects first, clearDisconnectTimer() cancels it.
   */
  private startDisconnectTimer(gameSessionId: string, userId: string) {
    const key = this.disconnectTimerKey(gameSessionId, userId);
    this.clearDisconnectTimer(gameSessionId, userId);

    const timer = setTimeout(async () => {
      this.disconnectTimers.delete(key);
      this.logger.log(
        `Disconnect grace period expired for user ${userId} in game ${gameSessionId} — forfeiting`,
      );

      const gameKey = `game:${gameSessionId}`;
      try {
        await this.redisClient.watch(gameKey);
        const stateStr = await this.redisClient.get(gameKey);
        if (!stateStr) {
          await this.redisClient.unwatch();
          return;
        }
        const state = JSON.parse(stateStr);
        if (state.status === 'match_completed') {
          await this.redisClient.unwatch();
          return;
        }

        // Forfeit: the disconnected player loses the match.
        const winnerId = state.players.find(
          (p: string) => p !== userId,
        ) as string;
        state.status = 'match_completed';
        state.winner = winnerId;

        // Record final round snapshot if not already captured.
        if (!Array.isArray(state.roundHistory)) state.roundHistory = [];
        if (
          !state.roundHistory.some((r: any) => r?.round === state.currentRound)
        ) {
          state.roundHistory.push({
            round: state.currentRound,
            winner: winnerId,
            scores: { ...(state.scores ?? {}) },
          });
        }

        const multi = this.redisClient.multi();
        multi.set(gameKey, JSON.stringify(state));
        this.matchmakingService.deleteActiveGameKeysInMulti(
          multi,
          state.players,
        );
        const results = await multi.exec();

        if (!results) {
          await this.redisClient.unwatch().catch(() => {});
          return;
        }

        // Stop the turn timer — the game is over.
        this.clearTurnTimer(gameSessionId);

        const mmrDeltas = await this.resolveMmrDeltasForMatch(
          state,
          winnerId,
          userId,
          true,
        );
        const payload = {
          state,
          forfeit: true,
          disconnectedUserId: userId,
          forfeitedByUserId: userId,
          mmrDeltas,
        };
        this.server.to(gameSessionId).emit('matchOver', payload);

        this.initializeRematch(gameSessionId, state).catch((e) =>
          this.logger.error(
            `initializeRematch (forfeit) failed: ${e?.message}`,
          ),
        );
      } catch (error) {
        this.logger.error(
          `Error in disconnect forfeit handler: ${error?.message}`,
          error?.stack,
        );
      } finally {
        await this.redisClient.unwatch().catch(() => {});
      }
    }, this.DISCONNECT_GRACE_MS);

    this.disconnectTimers.set(key, timer);
  }

  private clearDisconnectTimer(gameSessionId: string, userId: string) {
    const key = this.disconnectTimerKey(gameSessionId, userId);
    const existing = this.disconnectTimers.get(key);
    if (existing) {
      clearTimeout(existing);
      this.disconnectTimers.delete(key);
    }
  }

  // ─── Turn timer (full implementation) ────────────────────────────────────

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

        state.strikes[timedOutUserId] =
          (state.strikes[timedOutUserId] ?? 0) + 1;

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
          if (
            !state.roundHistory.some(
              (r: any) => r?.round === state.currentRound,
            )
          ) {
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
        if (isMatchOver) {
          this.matchmakingService.deleteActiveGameKeysInMulti(
            multi,
            state.players,
          );
        }
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
          this.clearTurnTimer(gameSessionId);
          const loserId = state.players.find(
            (p: string) => p !== state.winner,
          ) as string;
          const mmrDeltas = await this.resolveMmrDeltasForMatch(
            state,
            state.winner,
            loserId,
            false,
          );
          this.server.to(gameSessionId).emit('matchOver', {
            ...updatePayload,
            forfeit: false,
            mmrDeltas,
          });
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
          else if (latest.currentRound === 3)
            latest.currentTurn = latest.players[0];
          else latest.currentTurn = latest.players[0];

          const multi2 = this.redisClient.multi();
          multi2.set(key, JSON.stringify(latest));
          const results2 = await multi2.exec();
          if (!results2) {
            this.startTurnTimer(gameSessionId);
            return;
          }

          const nextPayload = {
            state: latest,
            lastGuess: updatePayload.lastGuess,
          };
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

  // ─── Connection lifecycle ─────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        this.logger.log(
          `Connection rejected: Missing token for client ${client.id}`,
        );
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'super-secret-jwt-key',
      });

      client.data.user = payload;
      const userId = String(payload.sub || payload.userId || '');
      if (userId) {
        await client.join(userId);
        await this.setPresenceOnline(userId);
        this.emitFriendsPresenceSnapshot(userId).catch(() => {});
      }
      this.logger.log(
        `Client connected: ${client.id} (User ID: ${payload.sub || payload.userId})`,
      );
    } catch {
      this.logger.log(
        `Connection rejected: Invalid token for client ${client.id}`,
      );
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const userId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );

    if (userId) {
      // Best-effort cleanup — fire-and-forget is fine on disconnect
      this.matchmakingService.cancelSearch(userId).catch(() => {});
      this.matchmakingService.cancelPrivateRoom(userId).catch(() => {});
      this.cancelActiveInvitesByInviter(userId, 'inviter_offline').catch(
        () => {},
      );
    }

    // For each game room the socket was in, start the reconnect grace period.
    // DO NOT clear the turn timer here — it keeps running fairly.
    // The disconnect timer will forfeit after DISCONNECT_GRACE_MS if they don't return.
    try {
      const rooms = Array.from(client.rooms ?? []);
      for (const room of rooms) {
        if (!room || room === client.id) continue;

        // Only act on rooms that look like active game sessions (have a live game state)
        const stateExists = await this.redisClient
          .exists(`game:${room}`)
          .catch(() => 0);
        if (!stateExists) continue;

        let endedMatch = false;
        try {
          const stateStr = await this.redisClient.get(`game:${room}`);
          if (stateStr) {
            const parsed = JSON.parse(stateStr) as { status?: string };
            endedMatch = parsed?.status === 'match_completed';
          }
        } catch {
          /* ignore */
        }

        if (endedMatch && userId) {
          this.server
            .to(room)
            .emit('opponentLeft', { userId, gameSessionId: room });
          this.logger.log(
            `User ${userId} left ended game ${room} — opponentLeft emitted`,
          );
          continue;
        }

        if (userId) {
          this.startDisconnectTimer(room, userId);
          this.server
            .to(room)
            .emit('playerDisconnected', { userId, gameSessionId: room });
          this.logger.log(
            `User ${userId} disconnected from game ${room} — grace period started`,
          );
        }
      }
    } catch (e) {
      this.logger.error(
        `Error in handleDisconnect cleanup: ${(e as Error)?.message}`,
      );
    }

    if (userId) {
      await this.clearPresence(userId).catch(() => {});
    }
  }

  // ─── Message handlers ─────────────────────────────────────────────────────

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

    await this.matchmakingService.joinQueue(
      userId,
      client.id,
      username,
      resolvedMode,
    );
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

  @SubscribeMessage('sendGameInvite')
  async handleSendGameInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody('friendId') friendId: string,
  ) {
    const userId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
    if (!userId) return { status: 'error', message: 'Unauthorized' };
    if (!friendId) return { status: 'error', message: 'friendId required' };

    const inviterUsername =
      client.data?.user?.username ||
      client.data?.user?.name ||
      client.data?.user?.email ||
      userId;

    try {
      const cooldownSet = await this.redisClient.set(
        this.inviteCooldownKey(userId),
        '1',
        'EX',
        this.INVITE_COOLDOWN_SECONDS,
        'NX',
      );
      if (cooldownSet !== 'OK') {
        return {
          status: 'error',
          message: 'Please wait 5 seconds before sending another invite.',
        };
      }

      await this.friendsService.ensureUsersAreFriends(userId, friendId);

      await this.matchmakingService.cancelPrivateRoom(userId).catch(() => {});

      const roomCode = await this.matchmakingService.createPrivateRoom(
        userId,
        client.id,
        inviterUsername,
      );

      await this.redisClient.set(
        this.inviteKey(userId, friendId),
        JSON.stringify({
          inviterId: userId,
          inviteeId: friendId,
          inviterUsername,
          roomCode,
          createdAt: new Date().toISOString(),
        }),
        'EX',
        this.INVITE_TTL_SECONDS,
      );

      this.server.to(friendId).emit('friendGameInvite', {
        inviterId: userId,
        inviterUsername,
        roomCode,
      });

      return { status: 'success', roomCode };
    } catch (error) {
      return {
        status: 'error',
        message: (error as Error)?.message || 'Failed to invite friend',
      };
    }
  }

  @SubscribeMessage('inviteFriendToGame')
  async handleInviteFriendToGame(
    @ConnectedSocket() client: Socket,
    @MessageBody('friendId') friendId: string,
  ) {
    return this.handleSendGameInvite(client, friendId);
  }

  @SubscribeMessage('cancelGameInvite')
  async handleCancelGameInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody('friendId') friendId: string,
  ) {
    const inviterId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
    if (!inviterId) return { status: 'error', message: 'Unauthorized' };
    if (!friendId) return { status: 'error', message: 'friendId required' };

    const key = this.inviteKey(inviterId, friendId);
    const deleted = await this.redisClient.del(key);
    await this.matchmakingService.cancelPrivateRoom(inviterId).catch(() => {});

    if (deleted > 0) {
      this.server.to(friendId).emit('inviteCancelledBySystem', {
        inviterId,
        inviteeId: friendId,
        reason: 'inviter_cancelled',
      });
    }

    return { status: 'ok' };
  }

  @SubscribeMessage('acceptGameInvite')
  async handleAcceptGameInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody('inviterId') inviterId: string,
  ) {
    const inviteeId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
    if (!inviteeId) return { status: 'error', message: 'Unauthorized' };
    if (!inviterId) return { status: 'error', message: 'inviterId required' };

    const key = this.inviteKey(inviterId, inviteeId);
    const rawInvite = await this.redisClient.get(key);
    if (!rawInvite) {
      return { status: 'error', message: 'Invite expired or unavailable' };
    }

    let invite: {
      roomCode: string;
      inviterUsername?: string;
    };
    try {
      invite = JSON.parse(rawInvite) as {
        roomCode: string;
        inviterUsername?: string;
      };
    } catch {
      await this.redisClient.del(key).catch(() => 0);
      return { status: 'error', message: 'Invite is invalid' };
    }

    await this.redisClient.del(key);

    const username =
      client.data?.user?.username ||
      client.data?.user?.name ||
      client.data?.user?.email ||
      inviteeId;

    const joinResult = await this.matchmakingService.joinPrivateRoom(
      invite.roomCode,
      inviteeId,
      client.id,
      username,
    );

    if (!joinResult?.success || !joinResult.gameSessionId) {
      this.server.to(inviterId).emit('inviteCancelledBySystem', {
        inviterId,
        inviteeId,
        reason: 'invite_expired',
      });
      return {
        status: 'error',
        message: joinResult?.error ?? 'Could not accept invite',
      };
    }

    this.server.to(inviterId).emit('inviteAccepted', {
      inviterId,
      inviteeId,
      gameSessionId: joinResult.gameSessionId,
    });

    return { status: 'ok', gameSessionId: joinResult.gameSessionId };
  }

  @SubscribeMessage('declineGameInvite')
  async handleDeclineGameInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody('inviterId') inviterId: string,
  ) {
    const inviteeId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
    if (!inviteeId) return { status: 'error', message: 'Unauthorized' };
    if (!inviterId) return { status: 'error', message: 'inviterId required' };

    const key = this.inviteKey(inviterId, inviteeId);
    const deleted = await this.redisClient.del(key);
    if (deleted > 0) {
      await this.matchmakingService
        .cancelPrivateRoom(inviterId)
        .catch(() => {});
      this.server.to(inviterId).emit('inviteDeclined', {
        inviterId,
        inviteeId,
      });
    }

    return { status: 'ok' };
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
    const userId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
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
        p1Id: string;
        p2Id: string;
        p1Name: string;
        p2Name: string;
        p1Ready: boolean;
        p2Ready: boolean;
        isRanked?: boolean;
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
        return {
          status: 'retry',
          message: 'Concurrent update, please try again',
        };
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
          rematch.isRanked === true,
        );

        // Move all sockets still in the old room into the new one.
        this.server.in(gameSessionId).socketsJoin(newGameSessionId);
        await Promise.all([
          this.setPresenceInGame(rematch.p1Id, newGameSessionId),
          this.setPresenceInGame(rematch.p2Id, newGameSessionId),
        ]);
        this.server
          .to(gameSessionId)
          .emit('rematchStarting', { newGameSessionId });
        this.server
          .to(newGameSessionId)
          .emit('gameStateUpdated', { state: newState });
        this.startTurnTimer(newGameSessionId);

        this.logger.log(
          `Rematch started: ${newGameSessionId} (from ${gameSessionId})`,
        );
      }

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Error in requestRematch: ${error?.message}`,
        error?.stack,
      );
      return { status: 'error', message: 'Internal server error' };
    } finally {
      await this.redisClient.unwatch().catch(() => {});
    }
  }

  @SubscribeMessage('leaveEndedMatch')
  async handleLeaveEndedMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody('gameSessionId') gameSessionId: string,
  ) {
    const userId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
    if (!userId || !gameSessionId) {
      return { status: 'error', message: 'Invalid request' };
    }

    try {
      const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
      if (!stateStr) {
        await this.setPresenceOnline(userId).catch(() => {});
        return { status: 'ok' };
      }
      const state = JSON.parse(stateStr) as { status?: string };
      if (state?.status !== 'match_completed') {
        return { status: 'error', message: 'Match is not finished' };
      }
      await this.setPresenceOnline(userId);
      client.leave(gameSessionId);
      this.server
        .to(gameSessionId)
        .emit('opponentLeft', { userId, gameSessionId });
      this.logger.log(
        `User ${userId} acknowledged leaving ended match ${gameSessionId}`,
      );
      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `leaveEndedMatch failed: ${error?.message}`,
        error?.stack,
      );
      return { status: 'error', message: 'Internal server error' };
    }
  }

  @SubscribeMessage('joinGameRoom')
  async handleJoinGameRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody('gameSessionId') gameSessionId: string,
  ) {
    const userId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    if (!gameSessionId)
      return { status: 'error', message: 'gameSessionId required' };

    // 1. Put the new socket into the room.
    client.join(gameSessionId);
    this.logger.log(
      `User ${userId} joined game room ${gameSessionId} (socket ${client.id})`,
    );
    this.cancelActiveInvitesByInviter(userId, 'inviter_in_game').catch(
      () => {},
    );
    await this.setPresenceInGame(userId, gameSessionId).catch(() => {});

    // 2. Reconnection check: if there's a pending disconnect timer for this player,
    //    cancel it and notify the room that they're back.
    const hadDisconnectTimer = this.disconnectTimers.has(
      this.disconnectTimerKey(gameSessionId, userId),
    );
    if (hadDisconnectTimer) {
      this.clearDisconnectTimer(gameSessionId, userId);

      // Re-fetch state to check it's still in progress before restarting timer.
      try {
        const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
        if (stateStr) {
          const state = JSON.parse(stateStr);
          if (state.status !== 'match_completed') {
            this.server
              .to(gameSessionId)
              .emit('playerReconnected', { userId, gameSessionId });
            // Resume the turn timer so the game continues.
            this.startTurnTimer(gameSessionId);
            this.logger.log(
              `User ${userId} reconnected to game ${gameSessionId} — timer resumed`,
            );
          }
        }
      } catch (err) {
        this.logger.error(
          `Error during reconnect timer restore: ${(err as Error)?.message}`,
        );
      }
    }

    // 3. Fetch the current state from Redis and send it to this client immediately.
    try {
      const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
      if (stateStr) {
        // Send only to this specific client who just joined/reconnected.
        client.emit('gameStateUpdated', { state: JSON.parse(stateStr) });
      }
    } catch (err) {
      this.logger.error(
        `Error fetching state for reconnecting client: ${(err as Error)?.message}`,
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

      // ── Rate limit check ──────────────────────────────────────────────────
      if (this.isGuestRateLimited(String(userId))) {
        this.logger.warn(`Rate limit hit for user ${userId}`);
        client.emit('error', { message: 'Too many guesses — slow down.' });
        return { status: 'error', message: 'Rate limit exceeded' };
      }
      // ─────────────────────────────────────────────────────────────────────

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
        if (
          state.guessedPlayers.some(
            (g: any) =>
              (typeof g === 'string' ? g : g?.name) === matchedPlayer.name,
          )
        ) {
          // Penalty: treat already-guessed as a WRONG answer (strike) and proceed normally.
          isCorrect = false;
          state.strikes[userId] += 1;
        } else {
          state.guessedPlayers.push({
            name: matchedPlayer.name,
            guessedBy: userId,
          });
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
        if (
          !state.roundHistory.some((r: any) => r?.round === state.currentRound)
        ) {
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
      if (isMatchOver) {
        this.matchmakingService.deleteActiveGameKeysInMulti(
          multi,
          state.players,
        );
      }
      const results = await multi.exec();

      if (!results) {
        this.logger.error(
          `Redis transaction failed (concurrent modification) for gameSessionId: ${gameSessionId}`,
        );
        await this.redisClient.unwatch().catch(() => {});
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
        this.clearTurnTimer(gameSessionId);
        const loserId = state.players.find(
          (p: string) => p !== state.winner,
        ) as string;
        const mmrDeltas = await this.resolveMmrDeltasForMatch(
          state,
          state.winner,
          loserId,
          false,
        );
        this.server.to(gameSessionId).emit('matchOver', {
          ...updatePayload,
          forfeit: false,
          mmrDeltas,
        });
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
        else if (latest.currentRound === 3)
          latest.currentTurn = latest.players[0];
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

  @SubscribeMessage('forfeitMatch')
  async handleForfeitMatch(
    @ConnectedSocket() client: Socket,
    @MessageBody('gameSessionId') gameSessionId: string,
  ) {
    const userId = String(
      client.data?.user?.sub || client.data?.user?.userId || '',
    );
    if (!userId || !gameSessionId) {
      return { status: 'error', message: 'Invalid request' };
    }

    this.clearTurnTimer(gameSessionId);

    const gameKey = `game:${gameSessionId}`;
    try {
      await this.redisClient.watch(gameKey);
      const stateStr = await this.redisClient.get(gameKey);
      if (!stateStr) {
        await this.redisClient.unwatch();
        return { status: 'error', message: 'Game not found' };
      }
      const state = JSON.parse(stateStr);
      if (state.status === 'match_completed') {
        await this.redisClient.unwatch();
        return { status: 'error', message: 'Match already finished' };
      }
      if (!state.players?.includes(userId)) {
        await this.redisClient.unwatch();
        return { status: 'error', message: 'Not a player in this game' };
      }

      const winnerId = state.players.find(
        (p: string) => p !== userId,
      ) as string;
      state.status = 'match_completed';
      state.winner = winnerId;

      if (!Array.isArray(state.roundHistory)) state.roundHistory = [];
      if (
        !state.roundHistory.some((r: any) => r?.round === state.currentRound)
      ) {
        state.roundHistory.push({
          round: state.currentRound,
          winner: winnerId,
          scores: { ...(state.scores ?? {}) },
        });
      }

      const multi = this.redisClient.multi();
      multi.set(gameKey, JSON.stringify(state));
      this.matchmakingService.deleteActiveGameKeysInMulti(multi, state.players);
      const results = await multi.exec();

      if (!results) {
        await this.redisClient.unwatch().catch(() => {});
        return { status: 'error', message: 'Concurrent update, try again' };
      }

      this.clearTurnTimer(gameSessionId);

      const mmrDeltas = await this.resolveMmrDeltasForMatch(
        state,
        winnerId,
        userId,
        true,
      );
      this.server.to(gameSessionId).emit('matchOver', {
        state,
        forfeit: true,
        forfeitedByUserId: userId,
        mmrDeltas,
      });

      this.initializeRematch(gameSessionId, state).catch((e) =>
        this.logger.error(
          `initializeRematch (manual forfeit) failed: ${e?.message}`,
        ),
      );

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Error in forfeitMatch: ${error?.message}`,
        error?.stack,
      );
      return { status: 'error', message: 'Internal server error' };
    } finally {
      await this.redisClient.unwatch().catch(() => {});
    }
  }
}
