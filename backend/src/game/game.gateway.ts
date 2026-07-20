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
import { checkBestOfNMatchWin } from './match-evaluator.util';
import type { QueueMode } from './matchmaking.service';
import { GameService } from './game.service';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { scoreMarginMultiplier } from './elo.util';
import { FriendsService } from '../friends/friends.service';
import { UsersService } from '../users/users.service';
import { GameModeStrategy } from './game-mode.strategy';
import { StrikesModeStrategy } from './strikes-mode.strategy';
import { Top10ModeStrategy } from './top10-mode.strategy';

// ─── In-gateway sliding-window rate limiter ────────────────────────────────
// Limits submitGuess to MAX_GUESSES_PER_WINDOW per user per WINDOW_MS.
// This runs in-process (no extra dependency) and is reset on server restart,
// which is acceptable — the goal is to stop DDoS bursts, not persistent abuse.
const GUESS_RATE_LIMIT_MAX = 5;
const GUESS_RATE_LIMIT_WINDOW_MS = 1000; // 1 second
// ─────────────────────────────────────────────────────────────────────────────

// Allowed WebSocket origins must match the REST CORS allow-list in main.ts.
// Override via FRONTEND_URL env var for production deployments.
const WS_ALLOWED_ORIGINS = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3001']
  : ['http://localhost:3001'];

@WebSocketGateway({ cors: { origin: WS_ALLOWED_ORIGINS, credentials: true } })
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
  private readonly inviteExpiryTimers = new Map<string, NodeJS.Timeout>();

  private readonly roundTransitionMs = 4000;

  /** Disconnect grace period before a forfeit is issued (ms). */
  private readonly DISCONNECT_GRACE_MS = 30_000;
  private readonly INVITE_COOLDOWN_SECONDS = 5;
  private readonly INVITE_TTL_SECONDS = 60;

  constructor(
    private readonly jwtService: JwtService,
    private readonly matchmakingService: MatchmakingService,
    private readonly gameService: GameService,
    private readonly redisClient: RedisService,
    private readonly friendsService: FriendsService,
    private readonly usersService: UsersService,
  ) {}

  private resolveStrategy(mode: string): GameModeStrategy {
    if (mode === 'TOP_10') {
      return new Top10ModeStrategy();
    }
    return new StrikesModeStrategy();
  }

  private flattenStateForFrontend(state: any) {
    if (!state) return state;
    const { modeState, ...envelope } = state;
    return { ...envelope, ...(modeState || {}) };
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private inviteCooldownKey(inviterId: string) {
    return `game_invite_cooldown:${inviterId}`;
  }

  private inviteKey(inviterId: string, inviteeId: string) {
    return `game_invite:${inviterId}:${inviteeId}`;
  }

  /**
   * Secondary index: a Redis Set that tracks all inviteeIds currently
   * invited by `inviterId`.  Used instead of `KEYS` pattern scans.
   * TTL is set to INVITE_TTL_SECONDS + 5s to outlive the invite itself.
   */
  private invitesSentKey(inviterId: string) {
    return `game_invites_sent:${inviterId}`;
  }

  private inviteTimerKey(inviterId: string, inviteeId: string) {
    return `${inviterId}:${inviteeId}`;
  }

  private clearInviteExpiryTimer(inviterId: string, inviteeId: string) {
    const key = this.inviteTimerKey(inviterId, inviteeId);
    const timeout = this.inviteExpiryTimers.get(key);
    if (!timeout) return;
    clearTimeout(timeout);
    this.inviteExpiryTimers.delete(key);
  }

  private scheduleInviteExpiry(inviterId: string, inviteeId: string) {
    this.clearInviteExpiryTimer(inviterId, inviteeId);

    const timeout = setTimeout(
      async () => {
        const timerKey = this.inviteTimerKey(inviterId, inviteeId);
        this.inviteExpiryTimers.delete(timerKey);

        const exists = await this.redisClient
          .exists(this.inviteKey(inviterId, inviteeId))
          .catch(() => 0);
        if (!exists) {
          // Already handled (accepted / cancelled / declined) — just clean up index.
          await this.redisClient
            .srem(this.invitesSentKey(inviterId), inviteeId)
            .catch(() => {});
          return;
        }

        // Key still present — natural TTL expiry. Clean up index + invite key + room.
        await this.redisClient
          .multi()
          .del(this.inviteKey(inviterId, inviteeId))
          .srem(this.invitesSentKey(inviterId), inviteeId)
          .exec()
          .catch(() => {});

        await this.matchmakingService
          .cancelPrivateRoom(inviterId)
          .catch(() => {});
        this.server.to(inviterId).emit('inviteCancelledBySystem', {
          inviterId,
          inviteeId,
          reason: 'invite_expired',
        });
      },
      this.INVITE_TTL_SECONDS * 1000 + 250,
    );

    this.inviteExpiryTimers.set(
      this.inviteTimerKey(inviterId, inviteeId),
      timeout,
    );
  }

  private async cancelActiveInvitesByInviter(
    inviterId: string,
    reason: 'inviter_offline' | 'inviter_in_game',
  ) {
    // O(1) lookup via the secondary index instead of a keyspace KEYS scan.
    const inviteeIds = await this.redisClient
      .smembers(this.invitesSentKey(inviterId))
      .catch(() => [] as string[]);
    if (!inviteeIds.length) return;

    // Build invite keys from the known invitee IDs.
    const inviteKeys = inviteeIds.map((id) => this.inviteKey(inviterId, id));

    // Atomically delete all invite keys + the index itself.
    const multi = this.redisClient.multi();
    inviteKeys.forEach((k) => multi.del(k));
    multi.del(this.invitesSentKey(inviterId));
    await multi.exec().catch(() => {});

    await this.matchmakingService.cancelPrivateRoom(inviterId).catch(() => {});

    inviteeIds.forEach((inviteeId) => {
      this.clearInviteExpiryTimer(inviterId, inviteeId);
    });

    inviteeIds.forEach((inviteeId) => {
      this.server.to(inviteeId).emit('inviteCancelledBySystem', {
        inviterId,
        inviteeId,
        reason,
      });
    });
  }

  private async cancelPendingInvitesForInvitee(
    inviteeId: string,
    reason: 'invitee_offline' | 'invitee_in_game',
  ) {
    // Resolve all inviters who have a live invite to this invitee.
    // This requires iterating all online users' sent-invite Sets.  Rather than
    // a keyspace scan we use the presence hash to bound the search: only online
    // users can have sent a live invite, so we only check their Sets.
    //
    // Pattern: KEYS `game_invite:*:{inviteeId}` is replaced by:
    //   for each online userId that is NOT inviteeId:
    //     SISMEMBER game_invites_sent:{userId} inviteeId
    // This is O(online_users) instead of O(keyspace), which is fine at scale.
    const onlineUserIds = await this.redisClient
      .hkeys('presence')
      .catch(() => [] as string[]);

    const inviters = new Set<string>();
    await Promise.all(
      onlineUserIds
        .filter((uid) => uid !== inviteeId)
        .map(async (uid) => {
          const isMember = await this.redisClient
            .sismember(this.invitesSentKey(uid), inviteeId)
            .catch(() => 0);
          if (isMember) inviters.add(uid);
        }),
    );

    if (!inviters.size) return;

    // Delete invite keys and clean up index entries atomically.
    const multi = this.redisClient.multi();
    for (const inviterId of inviters) {
      multi.del(this.inviteKey(inviterId, inviteeId));
      multi.srem(this.invitesSentKey(inviterId), inviteeId);
    }
    await multi.exec().catch(() => {});

    await Promise.allSettled(
      Array.from(inviters).map((inviterId) =>
        this.matchmakingService.cancelPrivateRoom(inviterId),
      ),
    );

    for (const inviterId of inviters) {
      this.clearInviteExpiryTimer(inviterId, inviteeId);
      this.server.to(inviterId).emit('inviteCancelledBySystem', {
        inviterId,
        inviteeId,
        reason,
      });
    }
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

    // Step 1: fetch the full presence hash and the list of online users in two
    // Redis calls — no DB queries here.
    const [userIds, presenceRaw] = await Promise.all([
      this.redisClient.hkeys('presence').catch(() => [] as string[]),
      this.redisClient.hgetall('presence').catch(() => null),
    ]);
    if (!userIds.length || !presenceRaw) return;

    // Step 2: for each online user, resolve their accepted friend IDs from the
    // DB (1 query per user, select-only, no joins) then build the presence
    // snapshot from the in-memory presenceRaw map — zero extra Redis calls.
    await Promise.all(
      userIds.map(async (userId) => {
        try {
          const friendIds =
            await this.friendsService.getAcceptedFriendIds(userId);
          if (!friendIds.length) return;

          const friends = friendIds.map((friendId) => {
            const raw = presenceRaw[friendId];
            if (!raw) return { userId: friendId, status: 'offline' as const };
            // presence values: 'online' | 'in-game:{gameSessionId}'
            if (raw.startsWith('in-game:')) {
              return {
                userId: friendId,
                status: 'in-game' as const,
                gameSessionId: raw.slice('in-game:'.length),
              };
            }
            return { userId: friendId, status: raw as 'online' };
          });

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
    playerAId: string,
    playerBId: string,
    winnerId: string | null,
    forfeited: boolean,
  ): Promise<Record<string, number> | undefined> {
    if (!state?.isRanked || !playerAId || !playerBId) return undefined;
    
    if (winnerId === null) {
      // Genuine draw
      const res = await this.matchmakingService.updateMmrAfterDraw(
        playerAId,
        playerBId,
      );
      if (!res) return undefined;
      return { [playerAId]: res.deltaA, [playerBId]: res.deltaB };
    }

    const loserId = winnerId === playerAId ? playerBId : playerAId;
    const w = Number(state.modeState?.overallScores?.[winnerId] ?? 0);
    const l = Number(state.modeState?.overallScores?.[loserId] ?? 0);
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
   * Starts the 30-second reconnection grace timer for a disconnected player.
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
        let state = JSON.parse(stateStr);
        if (state.status === 'match_completed') {
          await this.redisClient.unwatch();
          return;
        }

        const outcome = this.resolveStrategy(state.mode).handleDisconnectTimeout(state, userId);
        state = outcome.updatedState;
        const winnerId = outcome.winnerId;

        // Record final round snapshot — delegated to strategy so gateway never
        // touches modeState fields directly (see handleDisconnectTimeout outcome).
        const ms = state.modeState;
        if (!Array.isArray(ms.roundHistory)) ms.roundHistory = [];
        if (!ms.roundHistory.some((r: any) => r?.round === ms.currentRound)) {
          ms.roundHistory.push({
            round: ms.currentRound,
            winner: winnerId,
            scores: { ...(ms.scores ?? {}) },
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
          this.logger.debug(
            `Disconnect forfeit skipped due to concurrent update for game ${gameSessionId}`,
          );
          return;
        }

        // Stop the turn timer — the game is over.
        this.clearTurnTimer(gameSessionId);

        const mmrDeltas = await this.resolveMmrDeltasForMatch(
          state,
          state.players[0],
          state.players[1],
          winnerId,
          true,
        );
        const mmrLost = state.isRanked
          ? Math.max(0, -(mmrDeltas?.[userId] ?? -15))
          : 0;
        await this.usersService
          .recordOfflinePenalty(userId, gameSessionId, mmrLost)
          .catch((error) => {
            const err = error as Error;
            this.logger.error(
              `Failed to persist offline penalty for ${userId}: ${err?.message}`,
            );
          });
        const payload = {
          // TODO: remove flatten shim once frontend reads state.modeState directly
          state: this.flattenStateForFrontend(state),
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

  private startTurnTimer(gameSessionId: string, remainingMs: number = 10_000) {
    this.clearTurnTimer(gameSessionId);

    const timeout = setTimeout(async () => {
      // Timer fired; remove it first to avoid duplicates on restart
      this.turnTimers.delete(gameSessionId);

      const key = `game:${gameSessionId}`;
      let attempt = 0;
      let success = false;
      let isRoundOver = false;
      let isMatchOver = false;
      let roundWinner: string | null = null;
      let state: any = null;

      while (attempt < 3 && !success) {
        try {
          await this.redisClient.watch(key);
          const stateStr = await this.redisClient.get(key);
          if (!stateStr) {
            await this.redisClient.unwatch();
            return;
          }

          state = JSON.parse(stateStr);

          if (state.status === 'match_completed') {
            await this.redisClient.unwatch();
            return;
          }

          const timedOutUserId = state.modeState.currentTurn;
          if (!timedOutUserId) {
            await this.redisClient.unwatch();
            return;
          }

          const outcome = this.resolveStrategy(state.mode).handleTurnTimeout(state, timedOutUserId);
          isRoundOver = outcome.isRoundOver ?? false;
          roundWinner = 'roundWinner' in outcome ? (outcome.roundWinner ?? null) : null;

          if (isRoundOver) {
            const matchOutcome = checkBestOfNMatchWin(state);
            isMatchOver = matchOutcome.isMatchOver;
            if (isMatchOver) {
              state.status = 'match_completed';
              state.winner = matchOutcome.winnerId;
            }

            // Record the round result snapshot for the Game Over history view
            const ms = state.modeState;
            if (!Array.isArray(ms.roundHistory)) ms.roundHistory = [];
            if (!ms.roundHistory.some((r: any) => r?.round === ms.currentRound)) {
              ms.roundHistory.push({
                round: ms.currentRound,
                winner: roundWinner,
                scores: { ...(ms.scores ?? {}) },
              });
            }
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
            attempt++;
            if (attempt < 3) await new Promise(res => setTimeout(res, 50));
            continue;
          }
          success = true;
        } catch (e) {
          await this.redisClient.unwatch().catch(() => {});
          attempt++;
          if (attempt < 3) await new Promise(res => setTimeout(res, 50));
        }
      }

      if (!success) {
        this.logger.error(
          `Auto-strike timeout failed after 3 attempts (WATCH conflict) for gameSessionId: ${gameSessionId}`,
        );
        return;
      }

      const updatePayload = {
        // TODO: remove flatten shim once frontend reads state.modeState directly
        state: this.flattenStateForFrontend(state),
        lastGuess: {
          user: state.modeState.currentTurn,
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
        const mmrDeltas = await this.resolveMmrDeltasForMatch(
          state,
          state.players[0],
          state.players[1],
          state.winner,
          false,
        );
        this.server.to(gameSessionId).emit('matchOver', {
          ...updatePayload,
          forfeit: false,
          mmrDeltas,
        });
        this.initializeRematch(gameSessionId, state).catch((e) =>
          this.logger.error(`initializeRematch (turn timeout) failed: ${e?.message}`),
        );
      } else if (isRoundOver) {
        this.server.to(gameSessionId).emit('roundOver', {
          winner: roundWinner,
          nextRoundIn: this.roundTransitionMs / 1000,
        });

        await this.sleep(this.roundTransitionMs);

        // Start next round after transition
        let nextRoundAttempt = 0;
        let nextRoundSuccess = false;
        let latest: any = null;

        while (nextRoundAttempt < 3 && !nextRoundSuccess) {
          try {
            await this.redisClient.watch(key);
            const latestStr = await this.redisClient.get(key);
            if (!latestStr) {
              await this.redisClient.unwatch();
              return;
            }
            latest = JSON.parse(latestStr);

            if (latest.status === 'match_completed') {
              await this.redisClient.unwatch();
              return;
            }

            latest.modeState.currentRound += 1;
            latest.modeState.roundWinnerId = null;
            latest.mode = latest.composition[latest.modeState.currentRound - 1];
            this.resolveStrategy(latest.mode).initializeRoundState(latest);
            const nextQuestion = await this.gameService.getRandomQuestion(latest.mode, latest.modeState.usedQuestionIds || []);
            latest.modeState.currentQuestion = nextQuestion;
            if (nextQuestion) {
              if (!latest.modeState.usedQuestionIds) latest.modeState.usedQuestionIds = [];
              latest.modeState.usedQuestionIds.push(nextQuestion.id);
            }

            const multi2 = this.redisClient.multi();
            multi2.set(key, JSON.stringify(latest));
            const results2 = await multi2.exec();

            if (!results2) {
              nextRoundAttempt++;
              if (nextRoundAttempt < 3) await new Promise(res => setTimeout(res, 50));
              continue;
            }
            nextRoundSuccess = true;
          } catch (e) {
            await this.redisClient.unwatch().catch(() => {});
            nextRoundAttempt++;
            if (nextRoundAttempt < 3) await new Promise(res => setTimeout(res, 50));
          }
        }

        if (!nextRoundSuccess) {
          this.logger.error(
            `Failed to start next round after 3 attempts (WATCH conflict) for gameSessionId: ${gameSessionId}`,
          );
          return;
        }

        const nextPayload = {
          // TODO: remove flatten shim once frontend reads state.modeState directly
          state: this.flattenStateForFrontend(latest),
          lastGuess: updatePayload.lastGuess,
        };

        this.server.to(gameSessionId).emit('nextRoundStarted', nextPayload);
        this.startTurnTimer(gameSessionId);
      } else {
        this.startTurnTimer(gameSessionId);
      }
    }, Math.max(0, remainingMs));

    this.turnTimers.set(gameSessionId, timeout);
  }

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
        this.friendsService
          .countIncomingFriendRequests(userId)
          .then((pendingIncomingFriendRequests) => {
            client.emit('friendRequestCountSnapshot', {
              pendingIncomingFriendRequests,
            });
          })
          .catch(() => {});
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
      // Best-effort but explicit cleanup for queue/private room/invites on offline.
      await Promise.allSettled([
        this.matchmakingService.cancelSearch(userId),
        this.matchmakingService.cancelPrivateRoom(userId),
        this.cancelActiveInvitesByInviter(userId, 'inviter_offline'),
        this.cancelPendingInvitesForInvitee(userId, 'invitee_offline'),
      ]);
    }

    // Resolve the user's active match from Redis instead of socket rooms.
    // Socket.io can drop room membership during disconnect teardown.
    try {
      if (userId) {
        const gameSessionId =
          await this.matchmakingService.getActiveGameSessionIdForUser(userId);

        if (gameSessionId) {
          this.startDisconnectTimer(gameSessionId, userId);
          this.server
            .to(gameSessionId)
            .emit('playerDisconnected', { userId, gameSessionId });
          this.logger.log(
            `User ${userId} disconnected from active game ${gameSessionId} — grace period started`,
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
      // Prune the rate-limit map to prevent unbounded memory growth on disconnect.
      this.guessTimestamps.delete(userId);
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

    const res = await this.matchmakingService.joinQueue(
      userId,
      client.id,
      username,
      resolvedMode,
    );
    if (!res.success) return { status: 'error', message: res.error };
    return { status: 'queued', mode: resolvedMode };
  }

  @SubscribeMessage('cancelSearch')
  async handleCancelSearch(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const res = await this.matchmakingService.cancelSearch(userId);
    if (!res.success) return { status: 'error', message: res.error };
    return { status: 'ok' };
  }

  @SubscribeMessage('cancelPrivateRoom')
  async handleCancelPrivateRoom(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const res = await this.matchmakingService.cancelPrivateRoom(userId);
    if (!res.success) return { status: 'error', message: res.error };
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

    const res = await this.matchmakingService.createPrivateRoom(
      userId,
      client.id,
      username,
    );
    if (!res.success) return { status: 'error', message: res.error };
    return { status: 'success', roomCode: res.roomCode };
  }

  @SubscribeMessage('sendGameInvite')
  async handleSendGameInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody('friendId') friendId: string,
    @MessageBody('config') config?: { composition: any[]; timerConfig: Record<string, number> },
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

      const res = await this.matchmakingService.createPrivateRoom(
        userId,
        client.id,
        inviterUsername,
        config,
      );
      if (!res.success) {
        return { status: 'error', message: res.error };
      }
      const roomCode = res.roomCode;

      await this.redisClient
        .multi()
        .set(
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
        )
        .sadd(this.invitesSentKey(userId), friendId)
        .expire(this.invitesSentKey(userId), this.INVITE_TTL_SECONDS + 5)
        .exec();
      this.scheduleInviteExpiry(userId, friendId);

      const payload = {
        inviterId: userId,
        inviterUsername,
        roomCode,
        ...(config && { config }),
      };

      this.server.to(friendId).emit('friendGameInvite', payload);

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
    @MessageBody('config') config?: { composition: any[]; timerConfig: Record<string, number> },
  ) {
    return this.handleSendGameInvite(client, friendId, config);
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
    const multi = this.redisClient.multi();
    multi.del(key);
    multi.srem(this.invitesSentKey(inviterId), friendId);
    const execResult = await multi.exec().catch(() => null);
    const deletedCount = execResult ? Number(execResult[0]?.[1] ?? 0) : 0;
    this.clearInviteExpiryTimer(inviterId, friendId);
    await this.matchmakingService.cancelPrivateRoom(inviterId).catch(() => {});

    if (deletedCount > 0) {
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
      await this.redisClient
        .multi()
        .del(key)
        .srem(this.invitesSentKey(inviterId), inviteeId)
        .exec()
        .catch(() => 0);
      return { status: 'error', message: 'Invite is invalid' };
    }

    await this.redisClient
      .multi()
      .del(key)
      .srem(this.invitesSentKey(inviterId), inviteeId)
      .exec();
    this.clearInviteExpiryTimer(inviterId, inviteeId);

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

    if (!joinResult?.success) {
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

    // Invalidate other pending invites sent by this host
    const otherInvitees = await this.redisClient.smembers(this.invitesSentKey(inviterId));
    if (otherInvitees && otherInvitees.length > 0) {
      const multi = this.redisClient.multi();
      otherInvitees.forEach((otherId) => {
        multi.del(this.inviteKey(inviterId, otherId));
        this.clearInviteExpiryTimer(inviterId, otherId);
        if (otherId !== inviteeId) {
          this.server.to(otherId).emit('inviteCancelledBySystem', {
            inviterId,
            inviteeId: otherId,
            reason: 'room_full',
          });
        }
      });
      multi.del(this.invitesSentKey(inviterId));
      await multi.exec();
    }

    this.server.to(inviterId).emit('lobbyStateUpdated', joinResult.roomData);
    this.server.to(client.id).emit('lobbyStateUpdated', joinResult.roomData);

    return { status: 'success', roomCode: invite.roomCode, roomData: joinResult.roomData };
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
    const multi2 = this.redisClient.multi();
    multi2.del(key);
    multi2.srem(this.invitesSentKey(inviterId), inviteeId);
    const execResult2 = await multi2.exec().catch(() => null);
    const deletedCount2 = execResult2 ? Number(execResult2[0]?.[1] ?? 0) : 0;
    if (deletedCount2 > 0) {
      await this.matchmakingService
        .cancelPrivateRoom(inviterId)
        .catch(() => {});
      this.clearInviteExpiryTimer(inviterId, inviteeId);
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

    if (!result.success) {
      return { status: 'error', message: result.error || 'Room not found or expired' };
    }

    // Invalidate other pending invites sent by this host
    const inviterId = result.roomData.hostId;
    const otherInvitees = await this.redisClient.smembers(this.invitesSentKey(inviterId));
    if (otherInvitees && otherInvitees.length > 0) {
      const multi = this.redisClient.multi();
      otherInvitees.forEach((otherId) => {
        multi.del(this.inviteKey(inviterId, otherId));
        this.clearInviteExpiryTimer(inviterId, otherId);
        if (otherId !== userId) {
          this.server.to(otherId).emit('inviteCancelledBySystem', {
            inviterId,
            inviteeId: otherId,
            reason: 'room_full',
          });
        }
      });
      multi.del(this.invitesSentKey(inviterId));
      await multi.exec();
    }

    this.server.to(inviterId).emit('lobbyStateUpdated', result.roomData);
    this.server.to(userId).emit('lobbyStateUpdated', result.roomData);

    return { status: 'success', roomCode, roomData: result.roomData };
  }

  @SubscribeMessage('toggleLobbyReady')
  async handleToggleLobbyReady(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const res = await this.matchmakingService.toggleLobbyReady(userId);
    if (!res.success) return { status: 'error', message: res.error };

    this.server.to(res.roomData.hostId).emit('lobbyStateUpdated', res.roomData);
    if (res.roomData.guestId) {
      this.server.to(res.roomData.guestId).emit('lobbyStateUpdated', res.roomData);
    }
    return { status: 'success' };
  }

  @SubscribeMessage('leaveLobby')
  async handleLeaveLobby(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const res = await this.matchmakingService.leaveLobby(userId);
    if (!res.success) return { status: 'error', message: res.error };

    if (res.isHost) {
      if (res.roomData.guestId) {
        this.server.to(res.roomData.guestId).emit('roomExpired', { roomCode: res.roomData.roomCode });
      }
    } else {
      this.server.to(res.roomData.hostId).emit('lobbyStateUpdated', res.roomData);
    }
    return { status: 'success' };
  }

  @SubscribeMessage('startLobbyMatch')
  async handleStartLobbyMatch(@ConnectedSocket() client: Socket) {
    const userId = client.data?.user?.sub || client.data?.user?.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    const res = await this.matchmakingService.startLobbyMatch(userId);
    if (!res.success) return { status: 'error', message: res.error };

    // Find all sockets for these users and join them to the gameSessionId
    const hostSockets = await this.server.in(res.roomData.hostId).fetchSockets();
    const guestSockets = await this.server.in(res.roomData.guestId).fetchSockets();
    for (const s of [...hostSockets, ...guestSockets]) {
      s.join(res.gameSessionId as string);
    }

    this.server.to(res.roomData.hostId).emit('matchFound', { gameSessionId: res.gameSessionId });
    this.server.to(res.roomData.guestId).emit('matchFound', { gameSessionId: res.gameSessionId });
    this.server.to(res.gameSessionId as string).emit('gameStateUpdated', { state: res.gameState });

    this.startTurnTimer(res.gameSessionId as string);

    return { status: 'success' };
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

        // Move all sockets still in the old room into the new one,
        // then immediately leave the old room to prevent cross-session events.
        this.server.in(gameSessionId).socketsJoin(newGameSessionId);
        this.server.in(gameSessionId).socketsLeave(gameSessionId);
        await Promise.all([
          this.setPresenceInGame(rematch.p1Id, newGameSessionId),
          this.setPresenceInGame(rematch.p2Id, newGameSessionId),
        ]);
        this.server
          .to(newGameSessionId)
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
      await Promise.allSettled([
        this.redisClient.del(`user_active_game:${userId}`),
        this.redisClient.del(`active_game:${userId}`),
      ]);
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

    const hadDisconnectTimer = this.disconnectTimers.has(
      this.disconnectTimerKey(gameSessionId, userId),
    );
    this.clearDisconnectTimer(gameSessionId, userId);

    // Always fetch current Redis state first so completed matches cannot be resurrected.
    let parsedState: any | null = null;
    try {
      const stateStr = await this.redisClient.get(`game:${gameSessionId}`);
      if (!stateStr) {
        return { status: 'error', message: 'Game session not found' };
      }
      parsedState = JSON.parse(stateStr);
      if (parsedState?.status === 'match_completed') {
        this.clearDisconnectTimer(gameSessionId, userId);
        // TODO: remove flatten shim once frontend reads state.modeState directly
        client.emit('gameStateUpdated', { state: this.flattenStateForFrontend(parsedState) });
        return {
          status: 'error',
          message: 'Match is already completed',
          finalState: parsedState,
        };
      }
    } catch (err) {
      this.logger.error(
        `Error fetching state before joinGameRoom: ${(err as Error)?.message}`,
      );
      return { status: 'error', message: 'Failed to load game state' };
    }

    // 1. Put the new socket into the room.
    client.join(gameSessionId);
    this.logger.log(
      `User ${userId} joined game room ${gameSessionId} (socket ${client.id})`,
    );
    await Promise.allSettled([
      this.matchmakingService.cancelSearch(userId),
      this.matchmakingService.cancelPrivateRoom(userId),
      this.cancelActiveInvitesByInviter(userId, 'inviter_in_game'),
      this.cancelPendingInvitesForInvitee(userId, 'invitee_in_game'),
      this.matchmakingService.setActiveGameSessionIdForUser(
        userId,
        gameSessionId,
      ),
    ]);
    await this.setPresenceInGame(userId, gameSessionId).catch(() => {});

    // 2. Reconnection check: if there's a pending disconnect timer for this player,
    //    cancel it and notify the room that they're back.
    if (hadDisconnectTimer) {
      const latestStateStr = await this.redisClient
        .get(`game:${gameSessionId}`)
        .catch(() => null);
      if (latestStateStr) {
        try {
          const latestState = JSON.parse(latestStateStr);
          if (latestState?.status === 'match_completed') {
            // TODO: remove flatten shim once frontend reads state.modeState directly
            client.emit('gameStateUpdated', { state: this.flattenStateForFrontend(latestState) });
            return {
              status: 'error',
              message: 'Match is already completed',
              finalState: latestState,
            };
          }
        } catch {
          return {
            status: 'error',
            message: 'Failed to load game state',
          };
        }
      }
      this.server
        .to(gameSessionId)
        .emit('playerReconnected', { userId, gameSessionId });
      // Resume the turn timer so the game continues.
      let remainingMs = 10_000;
      if (latestStateStr) {
        try {
          const latestState = JSON.parse(latestStateStr);
          if (latestState.modeState?.turnDeadlineAt) {
            remainingMs = latestState.modeState.turnDeadlineAt - Date.now();
          }
        } catch {}
      }
      this.startTurnTimer(gameSessionId, remainingMs);
      this.logger.log(
        `User ${userId} reconnected to game ${gameSessionId} — timer resumed`,
      );
    }

    // 3. Fetch the current state from Redis and send it to this client immediately.
    // Send only to this specific client who just joined/reconnected.
    // TODO: remove flatten shim once frontend reads state.modeState directly
    client.emit('gameStateUpdated', { state: this.flattenStateForFrontend(parsedState) });

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

      // 1. Database check (outside the retry loop)
      this.logger.log(`Performing fuzzy search for guess: "${guessName}"`);
      const matchedPlayers = await this.gameService.guessPlayer(guessName);
      this.logger.log(`Fuzzy search complete. Matches found: ${matchedPlayers.length}`);

      let matchedPlayer: any = null;
      let initialIsCorrect = false;
      let answerDetails: { rank?: number | null; slotLabel?: string | null } | null = null;

      if (matchedPlayers.length > 0) {
        const currentStateStr = await this.redisClient.get(key);
        if (currentStateStr) {
          try {
            const currentState = JSON.parse(currentStateStr);
            if (currentState.modeState?.currentQuestion) {
              for (const p of matchedPlayers) {
                // Check if already guessed
                const alreadyGuessed = currentState.modeState.guessedPlayers?.some(
                  (g: any) => (typeof g === 'string' ? g : g?.name) === p.name
                );
                if (alreadyGuessed) continue; // Skip already taken candidates

                const isCorrect = await this.gameService.validateAnswer(currentState.modeState.currentQuestion, p);
                if (isCorrect) {
                  answerDetails = await this.gameService.validateAndGetAnswerDetails(currentState.modeState.currentQuestion.id, p.id);
                }
                if (isCorrect) {
                  matchedPlayer = p;
                  initialIsCorrect = true;
                  break;
                }
              }
              // If no candidate is both un-guessed and correct, fallback to the top match
              // so the logic below registers it as either a wrong guess or an already-taken strike.
              if (!matchedPlayer) {
                if (matchedPlayers[0].isAmbiguous) {
                  matchedPlayer = null;
                } else {
                  matchedPlayer = matchedPlayers[0];
                }
                initialIsCorrect = false;
              }
            }
          } catch {}
        }
      }

      let attempt = 0;
      let success = false;
      let state: any = null;
      let isMatchOver = false;
      let isRoundOver = false;
      let roundWinner: string | null = null;
      let finalIsCorrect = false;

      while (attempt < 3 && !success) {
        try {
          this.logger.log(`Starting Redis transaction for gameSessionId: ${gameSessionId}, attempt ${attempt + 1}`);
          await this.redisClient.watch(key);
          const stateStr = await this.redisClient.get(key);

          if (!stateStr) {
            await this.redisClient.unwatch();
            this.logger.error(`Game session not found: ${gameSessionId}`);
            return { status: 'error', message: 'Game session not found' };
          }

          state = JSON.parse(stateStr);

          if (state.status === 'match_completed') {
            await this.redisClient.unwatch();
            this.logger.error(`Attempt to guess in completed match ${gameSessionId}`);
            return { status: 'error', message: 'Match is already completed' };
          }

          // Stage 2: Round lock primitive (now in modeState).
          if (state.modeState.roundWinnerId) {
            await this.redisClient.unwatch();
            return { status: 'error', message: 'Round already won, guess rejected.' };
          }



          finalIsCorrect = initialIsCorrect;
          if (
            matchedPlayer &&
            state.modeState.guessedPlayers.some(
              (g: any) =>
                (typeof g === 'string' ? g : g?.name) === matchedPlayer.name,
            )
          ) {
            finalIsCorrect = false;
          }

          const outcome = this.resolveStrategy(state.mode).handleGuess(state, userId, {
            isCorrect: finalIsCorrect,
            matchedPlayer,
            guessName,
            answerDetails, // Defined outside the loop if matched correctly
          });

          if (outcome.error) {
            await this.redisClient.unwatch();
            return { status: 'error', message: outcome.error };
          }

          isRoundOver = outcome.isRoundOver ?? false;
          roundWinner = 'roundWinner' in outcome ? (outcome.roundWinner ?? null) : null;

          if (isRoundOver) {
            const matchOutcome = checkBestOfNMatchWin(state);
            isMatchOver = matchOutcome.isMatchOver;
            if (isMatchOver) {
              state.status = 'match_completed';
              state.winner = matchOutcome.winnerId;
            }

            const ms = state.modeState;
            ms.roundWinnerId = roundWinner; // Write the round lock primitive
            if (!Array.isArray(ms.roundHistory)) ms.roundHistory = [];
            if (!ms.roundHistory.some((r: any) => r?.round === ms.currentRound)) {
              ms.roundHistory.push({
                round: ms.currentRound,
                winner: roundWinner,
                scores: { ...(ms.scores ?? {}) },
              });
            }
          }

          // Execute transaction
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
            attempt++;
            if (attempt < 3) await new Promise(res => setTimeout(res, 50));
            continue;
          }
          success = true;
        } catch (err) {
          await this.redisClient.unwatch().catch(() => {});
          attempt++;
          if (attempt < 3) await new Promise(res => setTimeout(res, 50));
        }
      }

      if (!success) {
        this.logger.error(
          `handleSubmitGuess failed after 3 attempts (WATCH conflict) for gameSessionId: ${gameSessionId}`,
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
        // TODO: remove flatten shim once frontend reads state.modeState directly
        state: this.flattenStateForFrontend(state),
        lastGuess: {
          user: userId,
          guess: guessName,
          correct: finalIsCorrect,
          matchedName: finalIsCorrect ? matchedPlayer.name : null,
        },
      };

      if (isMatchOver) {
        this.logger.log(`Broadcasting matchOver to room ${gameSessionId}`);
        this.clearTurnTimer(gameSessionId);
        const mmrDeltas = await this.resolveMmrDeltasForMatch(
          state,
          state.players[0],
          state.players[1],
          state.winner,
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

        // Start next round after transition
        let nextRoundAttempt = 0;
        let nextRoundSuccess = false;
        let latest: any = null;

        while (nextRoundAttempt < 3 && !nextRoundSuccess) {
          try {
            await this.redisClient.watch(key);
            const latestStr = await this.redisClient.get(key);
            if (!latestStr) {
              await this.redisClient.unwatch();
              return { status: 'error', message: 'Game session not found' };
            }
            latest = JSON.parse(latestStr);

            if (latest.status === 'match_completed') {
              await this.redisClient.unwatch();
              return { status: 'success', isCorrect: finalIsCorrect, matchedPlayer };
            }

            latest.modeState.currentRound += 1;
            latest.modeState.roundWinnerId = null;
            latest.mode = latest.composition[latest.modeState.currentRound - 1];
            this.resolveStrategy(latest.mode).initializeRoundState(latest);
            const nextQuestion = await this.gameService.getRandomQuestion(latest.mode, latest.modeState.usedQuestionIds || []);
            latest.modeState.currentQuestion = nextQuestion;
            if (nextQuestion) {
              if (!latest.modeState.usedQuestionIds) latest.modeState.usedQuestionIds = [];
              latest.modeState.usedQuestionIds.push(nextQuestion.id);
            }

            const multi2 = this.redisClient.multi();
            multi2.set(key, JSON.stringify(latest));
            const results2 = await multi2.exec();

            if (!results2) {
              nextRoundAttempt++;
              if (nextRoundAttempt < 3) await new Promise(res => setTimeout(res, 50));
              continue;
            }
            nextRoundSuccess = true;
          } catch (err) {
            await this.redisClient.unwatch().catch(() => {});
            nextRoundAttempt++;
            if (nextRoundAttempt < 3) await new Promise(res => setTimeout(res, 50));
          }
        }

        if (!nextRoundSuccess) {
          this.logger.error(`Failed to transition to next round after 3 attempts for ${gameSessionId}`);
          return { status: 'error', message: 'Concurrent modification, try again' };
        }

        const nextPayload = {
          // TODO: remove flatten shim once frontend reads state.modeState directly
          state: this.flattenStateForFrontend(latest),
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

      return { status: 'success', isCorrect: finalIsCorrect, matchedPlayer };
    } catch (error) {
      this.logger.error(
        `Exception in handleSubmitGuess: ${error.message}`,
        error.stack,
      );
      await this.redisClient.unwatch().catch(() => {});
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

      const outcome = this.resolveStrategy(state.mode).handleForfeit(state, userId);
      const forfeitedState = outcome.updatedState;
      const winnerId = outcome.winnerId;

      const multi = this.redisClient.multi();
      multi.set(gameKey, JSON.stringify(forfeitedState));
      this.matchmakingService.deleteActiveGameKeysInMulti(multi, forfeitedState.players);
      const results = await multi.exec();

      if (!results) {
        await this.redisClient.unwatch().catch(() => {});
        return { status: 'error', message: 'Concurrent update, try again' };
      }

      this.clearTurnTimer(gameSessionId);

      const mmrDeltas = await this.resolveMmrDeltasForMatch(
        forfeitedState,
        forfeitedState.players[0],
        forfeitedState.players[1],
        winnerId,
        true,
      );
      this.server.to(gameSessionId).emit('matchOver', {
        // TODO: remove flatten shim once frontend reads state.modeState directly
        state: this.flattenStateForFrontend(forfeitedState),
        forfeit: true,
        forfeitedByUserId: userId,
        mmrDeltas,
      });

      this.initializeRematch(gameSessionId, forfeitedState).catch((e) =>
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
