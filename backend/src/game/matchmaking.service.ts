import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { Server } from 'socket.io';
import { randomUUID, randomBytes } from 'crypto';
import { pickRandomFootballQuestion } from './game.questions';
import { calculateElo } from './elo.util';
import type { ChainableCommander } from 'ioredis';

export type QueueMode = 'ranked' | 'unrated';

interface QueueEntry {
  userId: string;
  socketId: string;
  username?: string;
}

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private server!: Server;
  private startTurnTimerFn?: (gameSessionId: string) => void;
  private readonly searchExpiryTimers = new Map<string, NodeJS.Timeout>();
  private readonly roomExpiryTimers = new Map<string, NodeJS.Timeout>();
  private readonly SEARCH_TTL_SECONDS = 60;
  private readonly PRIVATE_ROOM_TTL_SECONDS = 60;

  /** Redis key pairs for each queue mode. */
  private readonly QUEUES: Record<
    QueueMode,
    { list: string; members: string }
  > = {
    ranked: { list: 'ranked_queue', members: 'ranked_queue_members' },
    unrated: { list: 'unrated_queue', members: 'unrated_queue_members' },
  };

  constructor(
    private readonly redisClient: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  setTurnTimerStarter(fn: (gameSessionId: string) => void) {
    this.startTurnTimerFn = fn;
  }

  private queueSearchKey(userId: string) {
    return `queue_search:${userId}`;
  }

  private clearSearchExpiryTimer(userId: string) {
    const timer = this.searchExpiryTimers.get(userId);
    if (!timer) return;
    clearTimeout(timer);
    this.searchExpiryTimers.delete(userId);
  }

  private scheduleSearchExpiry(
    userId: string,
    socketId: string,
    mode: QueueMode,
  ) {
    this.clearSearchExpiryTimer(userId);

    const timeout = setTimeout(async () => {
      this.searchExpiryTimers.delete(userId);
      const key = this.queueSearchKey(userId);
      const stillSearching = await this.redisClient.exists(key).catch(() => 0);
      if (!stillSearching) return;

      await this.cancelSearch(userId).catch(() => {});
      this.server?.to(userId).emit('searchExpired', { mode });
      this.server?.to(socketId).emit('searchExpired', { mode });
    }, this.SEARCH_TTL_SECONDS * 1000);

    this.searchExpiryTimers.set(userId, timeout);
  }

  private clearRoomExpiryTimer(userId: string) {
    const timer = this.roomExpiryTimers.get(userId);
    if (!timer) return;
    clearTimeout(timer);
    this.roomExpiryTimers.delete(userId);
  }

  private schedulePrivateRoomExpiry(userId: string, roomCode: string) {
    this.clearRoomExpiryTimer(userId);

    const timeout = setTimeout(async () => {
      this.roomExpiryTimers.delete(userId);

      const userRoomKey = `user_room:${userId}`;
      const privateRoomKey = `private_room:${roomCode}`;
      const currentRoomCode = await this.redisClient.get(userRoomKey);
      if (currentRoomCode !== roomCode) return;

      const roomExists = await this.redisClient
        .exists(privateRoomKey)
        .catch(() => 0);
      if (!roomExists) return;

      const multi = this.redisClient.multi();
      multi.del(privateRoomKey);
      multi.del(userRoomKey);
      await multi.exec();

      this.server?.to(userId).emit('roomExpired', { roomCode });
    }, this.PRIVATE_ROOM_TTL_SECONDS * 1000);

    this.roomExpiryTimers.set(userId, timeout);
  }

  // ─── Queue management ────────────────────────────────────────────────────

  /**
   * Adds a user to the specified queue.
   * Enforces mutual exclusivity:
   *   - removes the user from the opposite queue
   *   - destroys any private room they currently own
   */
  async joinQueue(
    userId: string,
    socketId: string,
    username: string | undefined,
    mode: QueueMode,
  ): Promise<void> {
    const { list, members } = this.QUEUES[mode];
    const opposite: QueueMode = mode === 'ranked' ? 'unrated' : 'ranked';

    // Leave the opposite queue (lazy deletion — just remove from the members set)
    await this.redisClient.srem(this.QUEUES[opposite].members, userId);

    // Destroy any private room the user is hosting
    await this.cleanupUserPrivateRoom(userId);

    // Idempotent re-add: remove first so a double-call doesn't create two list entries
    await this.redisClient.srem(members, userId);

    const entry: QueueEntry = { userId, socketId, username };
    await Promise.all([
      this.redisClient.lpush(list, JSON.stringify(entry)),
      this.redisClient.sadd(members, userId),
      this.redisClient.set(
        this.queueSearchKey(userId),
        JSON.stringify({ mode, socketId, createdAt: new Date().toISOString() }),
        'EX',
        this.SEARCH_TTL_SECONDS,
      ),
    ]);
    this.scheduleSearchExpiry(userId, socketId, mode);

    this.logger.log(`User ${userId} joined ${mode} queue`);
  }

  /**
   * Removes a user from all queues (lazy deletion — removes from members sets only).
   * Stale list entries are silently discarded when the queue is processed.
   */
  async cancelSearch(userId: string): Promise<void> {
    this.clearSearchExpiryTimer(userId);
    await Promise.all([
      this.redisClient.srem(this.QUEUES.ranked.members, userId),
      this.redisClient.srem(this.QUEUES.unrated.members, userId),
      this.redisClient.del(this.queueSearchKey(userId)),
    ]);
    this.logger.log(`User ${userId} removed from all queues`);
  }

  /**
   * Pops the next *valid* (non-cancelled) entry from a queue list.
   * Cancelled users are silently discarded via the lazy-deletion pattern:
   *   - Membership is tracked in a separate Redis Set.
   *   - A cancel call removes the user from the Set only; the list entry is
   *     discarded here the next time it surfaces.
   */
  private async popValidPlayer(
    list: string,
    members: string,
  ): Promise<QueueEntry | null> {
    // Cap iterations to avoid a spin-loop on a pathologically stale queue.
    const MAX_ATTEMPTS = 50;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const entryStr = await this.redisClient.rpop(list);
      if (!entryStr) return null; // queue is empty

      const entry: QueueEntry = JSON.parse(entryStr);
      const isMember = await this.redisClient.sismember(members, entry.userId);
      if (isMember) {
        const searchExists = await this.redisClient
          .exists(this.queueSearchKey(entry.userId))
          .catch(() => 0);
        if (!searchExists) {
          await this.redisClient.srem(members, entry.userId);
          this.clearSearchExpiryTimer(entry.userId);
          this.server?.to(entry.userId).emit('searchExpired', {
            mode: members === this.QUEUES.ranked.members ? 'ranked' : 'unrated',
          });
          this.server?.to(entry.socketId).emit('searchExpired', {
            mode: members === this.QUEUES.ranked.members ? 'ranked' : 'unrated',
          });
          continue;
        }

        // Atomically claim this slot
        await Promise.all([
          this.redisClient.srem(members, entry.userId),
          this.redisClient.del(this.queueSearchKey(entry.userId)),
        ]);
        this.clearSearchExpiryTimer(entry.userId);
        return entry;
      }
      // else: user cancelled — silently discard and keep popping
    }
    return null;
  }

  // ─── Private rooms ───────────────────────────────────────────────────────

  /**
   * Creates a private room for the given user.
   * Enforces mutual exclusivity: removes the user from any active queue first.
   * Stores two Redis keys:
   *   private_room:{code}  — room data (host socket + user info)
   *   user_room:{userId}   — reverse-lookup so we can destroy the room later
   */
  async createPrivateRoom(
    userId: string,
    socketId: string,
    username?: string,
  ): Promise<string> {
    // Cannot be in a queue and host a private room simultaneously
    await this.cancelSearch(userId);

    let roomCode = '';
    let isUnique = false;
    while (!isUnique) {
      roomCode = randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
      const exists = await this.redisClient.exists(`private_room:${roomCode}`);
      if (!exists) isUnique = true;
    }

    const TTL = this.PRIVATE_ROOM_TTL_SECONDS;
    const roomData = JSON.stringify({ userId, socketId, username });
    await Promise.all([
      this.redisClient.set(`private_room:${roomCode}`, roomData, 'EX', TTL),
      this.redisClient.set(`user_room:${userId}`, roomCode, 'EX', TTL),
    ]);
    this.schedulePrivateRoomExpiry(userId, roomCode);

    this.logger.log(`Private room ${roomCode} created by user ${userId}`);
    return roomCode;
  }

  /** Allows the host to cancel their own private room before anyone joins. */
  async cancelPrivateRoom(userId: string): Promise<void> {
    const cleanedRoomCode = await this.cleanupUserPrivateRoom(userId);

    // Only log if a room was actually found and deleted
    if (cleanedRoomCode) {
      this.logger.log(
        `Private room ${cleanedRoomCode} cancelled by user ${userId}`,
      );
    }
  }

  /**
   * Internal helper: deletes the private room owned by userId (if any).
   * Removes both the room key and the reverse-lookup key.
   * Returns the roomCode if one was deleted, otherwise returns null.
   */
  private async cleanupUserPrivateRoom(userId: string): Promise<string | null> {
    const userRoomKey = `user_room:${userId}`;
    const roomCode = await this.redisClient.get(userRoomKey);

    if (!roomCode) {
      this.clearRoomExpiryTimer(userId);
      return null;
    }

    const privateRoomKey = `private_room:${roomCode}`;
    const multi = this.redisClient.multi();
    multi.del(privateRoomKey);
    multi.del(userRoomKey);
    await multi.exec();
    this.clearRoomExpiryTimer(userId);
    return roomCode;
  }

  /**
   * Joins an existing private room and starts an unrated match.
   * Removes both host and guest from any active queues (mutual exclusivity).
   */
  async joinPrivateRoom(
    code: string,
    userId: string,
    socketId: string,
    username?: string,
  ) {
    const uppercaseCode = code.toUpperCase();
    const privateRoomKey = `private_room:${uppercaseCode}`;
    await this.redisClient.watch(privateRoomKey);
    const roomDataStr = await this.redisClient.get(privateRoomKey);

    if (!roomDataStr) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Room not found or expired' };
    }

    const host: QueueEntry = JSON.parse(roomDataStr);

    if (host.userId === userId) {
      await this.redisClient.unwatch();
      return { success: false, error: 'You cannot join your own room' };
    }

    // Consume the room atomically to prevent a second guest from joining.
    const multi = this.redisClient.multi();
    multi.del(privateRoomKey);
    multi.del(`user_room:${host.userId}`);
    const consumed = await multi.exec();

    if (!consumed) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Room not found or expired' };
    }

    await this.redisClient.unwatch().catch(() => {});
    this.clearRoomExpiryTimer(host.userId);

    // Both players must leave any public queue they were in
    await Promise.all([
      this.cancelSearch(host.userId),
      this.cancelSearch(userId),
    ]);

    const gameSessionId = randomUUID();
    const gameState = await this.initializeGameState(
      gameSessionId,
      host.userId,
      userId,
      host.username,
      username,
      false, // private matches are always unrated
    );

    if (this.server) {
      this.server.in([host.socketId, socketId]).socketsJoin(gameSessionId);
      this.server.to(host.socketId).emit('matchFound', { gameSessionId });
      this.server.to(socketId).emit('matchFound', { gameSessionId });
      this.server
        .to(gameSessionId)
        .emit('gameStateUpdated', { state: gameState });
      this.startTurnTimerFn?.(gameSessionId);
    }

    this.logger.log(
      `Private match created: ${gameSessionId} [${host.userId} vs ${userId}]`,
    );
    return { success: true, gameSessionId };
  }

  // ─── Matchmaking interval ────────────────────────────────────────────────

  @Interval(2000)
  async handleMatchmakingInterval() {
    if (!this.server) return;
    // Process both queues independently each tick
    await Promise.all([
      this.processQueue('ranked', true),
      this.processQueue('unrated', false),
    ]);
  }

  private async processQueue(
    mode: QueueMode,
    isRanked: boolean,
  ): Promise<void> {
    const { list, members } = this.QUEUES[mode];

    const queueLength = await this.redisClient.llen(list);
    if (queueLength < 2) return;

    const p1 = await this.popValidPlayer(list, members);
    if (!p1) return;

    const p2 = await this.popValidPlayer(list, members);
    if (!p2) {
      // Only one valid player found — put p1 back at the back of the line
      await this.redisClient.lpush(list, JSON.stringify(p1));
      await this.redisClient.sadd(members, p1.userId);
      return;
    }

    if (p1.userId === p2.userId) {
      // Duplicate entry for the same user — keep one slot, discard the other
      await this.redisClient.lpush(list, JSON.stringify(p2));
      await this.redisClient.sadd(members, p2.userId);
      return;
    }

    // Mutual exclusivity: destroy any private rooms either player might own
    await Promise.all([
      this.cleanupUserPrivateRoom(p1.userId),
      this.cleanupUserPrivateRoom(p2.userId),
    ]);

    const gameSessionId = randomUUID();
    const gameState = await this.initializeGameState(
      gameSessionId,
      p1.userId,
      p2.userId,
      p1.username,
      p2.username,
      isRanked,
    );

    this.server.in([p1.socketId, p2.socketId]).socketsJoin(gameSessionId);
    this.server.to(p1.socketId).emit('matchFound', { gameSessionId });
    this.server.to(p2.socketId).emit('matchFound', { gameSessionId });
    this.server
      .to(gameSessionId)
      .emit('gameStateUpdated', { state: gameState });
    this.startTurnTimerFn?.(gameSessionId);

    this.logger.log(
      `${isRanked ? 'Ranked' : 'Unrated'} match created: ${gameSessionId} ` +
        `[${p1.userId} vs ${p2.userId}]`,
    );
  }

  // ─── Game state ──────────────────────────────────────────────────────────

  async initializeGameState(
    gameSessionId: string,
    player1Id: string,
    player2Id: string,
    player1Username?: string,
    player2Username?: string,
    isRanked = false,
  ) {
    // Fetch current MMR for rank badge display on the frontend.
    // Use Promise.allSettled so a missing user doesn't abort game creation.
    const [p1Result, p2Result] = await Promise.allSettled([
      this.prisma.user.findUnique({
        where: { id: player1Id },
        select: { mmr: true },
      }),
      this.prisma.user.findUnique({
        where: { id: player2Id },
        select: { mmr: true },
      }),
    ]);
    const p1Mmr =
      p1Result.status === 'fulfilled' ? (p1Result.value?.mmr ?? 1000) : 1000;
    const p2Mmr =
      p2Result.status === 'fulfilled' ? (p2Result.value?.mmr ?? 1000) : 1000;

    const gameState = {
      players: [player1Id, player2Id],
      currentTurn: player1Id,
      playerNames: {
        [player1Id]: player1Username ?? String(player1Id),
        [player2Id]: player2Username ?? String(player2Id),
      },
      playerMmr: {
        [player1Id]: p1Mmr,
        [player2Id]: p2Mmr,
      },
      roundHistory: [],
      scores: { [player1Id]: 0, [player2Id]: 0 },
      overallScores: { [player1Id]: 0, [player2Id]: 0 },
      currentRound: 1,
      strikes: { [player1Id]: 0, [player2Id]: 0 },
      guessedPlayers: [],
      currentQuestion: pickRandomFootballQuestion(),
      isRanked, // consumed by gateway to decide whether to update MMR on completion
    };
    const gameKey = `game:${gameSessionId}`;
    const stateJson = JSON.stringify(gameState);
    const multi = this.redisClient.multi();
    multi.set(gameKey, stateJson);
    multi.set(`active_game:${player1Id}`, gameSessionId);
    multi.set(`active_game:${player2Id}`, gameSessionId);
    await multi.exec();
    return gameState;
  }

  /**
   * Queues DELs for `active_game:{playerId}` inside an existing MULTI (same EXEC as game state writes).
   */
  deleteActiveGameKeysInMulti(
    multi: ChainableCommander,
    playerIds: Array<string | number | undefined | null>,
  ): void {
    for (const raw of playerIds) {
      if (raw === undefined || raw === null) continue;
      const id = String(raw);
      if (!id) continue;
      multi.del(`active_game:${id}`);
    }
  }

  /**
   * Returns the user's current in-progress game session id from Redis, or null.
   */
  async getActiveGameSessionIdForUser(userId: string): Promise<string | null> {
    const uid = String(userId);
    const key = `active_game:${uid}`;
    const sessionId = await this.redisClient.get(key);
    if (!sessionId) return null;

    const gameKey = `game:${sessionId}`;
    const stateStr = await this.redisClient.get(gameKey);
    if (!stateStr) {
      await this.redisClient.del(key).catch(() => {});
      return null;
    }

    let state: { status?: string; players?: string[] };
    try {
      state = JSON.parse(stateStr) as { status?: string; players?: string[] };
    } catch {
      await this.redisClient.del(key).catch(() => {});
      return null;
    }

    if (state.status === 'match_completed') {
      const players = (state.players ?? []).map((p) => String(p));
      const m = this.redisClient.multi();
      this.deleteActiveGameKeysInMulti(m, players);
      await m.exec().catch(() => {});
      return null;
    }

    const players = (state.players ?? []).map((p) => String(p));
    if (!players.includes(uid)) {
      await this.redisClient.del(key).catch(() => {});
      return null;
    }

    return sessionId;
  }

  // ─── MMR ─────────────────────────────────────────────────────────────────

  /**
   * Applies Elo rating changes to both players after a ranked match completes.
   * Also increments gamesPlayed for both and wins for the winner.
   * @returns Exact MMR deltas applied (winner positive, loser negative), or null if skipped.
   */
  async updateMmrAfterMatch(
    winnerId: string,
    loserId: string,
    options?: { marginMultiplier?: number },
  ): Promise<{ winnerDelta: number; loserDelta: number } | null> {
    try {
      const [winner, loser] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: winnerId },
          select: { mmr: true },
        }),
        this.prisma.user.findUnique({
          where: { id: loserId },
          select: { mmr: true },
        }),
      ]);

      if (!winner || !loser) {
        this.logger.warn(
          `MMR update skipped — winner=${winnerId} found=${!!winner}, loser=${loserId} found=${!!loser}`,
        );
        return null;
      }

      const margin = options?.marginMultiplier ?? 1;
      const { winnerNewMmr, loserNewMmr, winnerDelta, loserDelta } =
        calculateElo(winner.mmr, loser.mmr, 32, margin);

      await Promise.all([
        this.prisma.user.update({
          where: { id: winnerId },
          data: {
            mmr: winnerNewMmr,
            wins: { increment: 1 },
            gamesPlayed: { increment: 1 },
          },
        }),
        this.prisma.user.update({
          where: { id: loserId },
          data: {
            mmr: loserNewMmr,
            gamesPlayed: { increment: 1 },
          },
        }),
      ]);

      this.logger.log(
        `MMR updated — winner ${winnerId}: ${winner.mmr} → ${winnerNewMmr} (+${winnerDelta}), ` +
          `loser ${loserId}: ${loser.mmr} → ${loserNewMmr} (${loserDelta})`,
      );

      return { winnerDelta, loserDelta };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`MMR update failed: ${err?.message}`, err?.stack);
      return null;
    }
  }
}
