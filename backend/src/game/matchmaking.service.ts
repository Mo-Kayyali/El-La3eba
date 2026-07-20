import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { Server } from 'socket.io';
import { randomUUID, randomBytes } from 'crypto';
import { calculateElo, calculateEloDraw } from './elo.util';
import type { ChainableCommander } from 'ioredis';
import { GameService } from './game.service';

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
  private readonly SEARCH_TTL_SECONDS = 60;
  private readonly ACTIVE_GAME_KEY_PREFIX = 'user_active_game:';

  /** Redis key pairs for each queue mode. */
  private readonly QUEUES: Record<
    QueueMode,
    { zset: string; members: string }
  > = {
    ranked: { zset: 'ranked_queue', members: 'ranked_queue_members' },
    unrated: { zset: 'unrated_queue', members: 'unrated_queue_members' },
  };

  constructor(
    private readonly redisClient: RedisService,
    private readonly prisma: PrismaService,
    private readonly gameService: GameService,
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

  private activeGameKey(userId: string) {
    return `${this.ACTIVE_GAME_KEY_PREFIX}${userId}`;
  }

  @Interval(10000)
  async handleRoomExpiryInterval() {
    if (!this.server) return;
    await this.purgeExpiredPrivateRooms();
  }

  private async purgeExpiredPrivateRooms() {
    const cutoff = Date.now();
    const expiredRooms = await this.redisClient.zrangebyscore('private_rooms_expiry', '-inf', cutoff);
    if (!expiredRooms.length) return;

    for (const roomCode of expiredRooms) {
      const roomDataRaw = await this.redisClient.get(`private_room:${roomCode}`);
      const multi = this.redisClient.multi();
      multi.del(`private_room:${roomCode}`);
      multi.zrem('private_rooms_expiry', roomCode);
      if (roomDataRaw) {
        try {
          const roomData = JSON.parse(roomDataRaw);
          if (roomData.hostId) {
            multi.del(`user_room:${roomData.hostId}`);
            this.server.to(roomData.hostId).emit('roomExpired', { roomCode });
          }
          if (roomData.guestId) {
            this.server.to(roomData.guestId).emit('roomExpired', { roomCode });
          }
        } catch (e) {}
      }
      await multi.exec();
    }
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
  ): Promise<{ success: boolean; error?: string }> {
    const queueCooldownKey = `queue_toggle_cooldown:${userId}`;
    const setCooldown = await this.redisClient.set(queueCooldownKey, '1', 'EX', 2, 'NX');
    if (!setCooldown) {
      return { success: false, error: 'Please wait a moment before toggling queue status.' };
    }

    const { zset, members } = this.QUEUES[mode];
    const opposite: QueueMode = mode === 'ranked' ? 'unrated' : 'ranked';

    await this.removeUserFromQueue(opposite, userId);

    // Destroy any private room the user is hosting
    await this.cleanupUserPrivateRoom(userId);

    // Idempotent re-add in the target queue.
    await Promise.all([
      this.redisClient.zrem(zset, userId),
      this.redisClient.srem(members, userId),
    ]);

    const createdAtMs = Date.now();

    const entry: QueueEntry = { userId, socketId, username };
    await Promise.all([
      this.redisClient.zadd(zset, createdAtMs, userId),
      this.redisClient.sadd(members, userId),
      this.redisClient.set(
        this.queueSearchKey(userId),
        JSON.stringify({
          mode,
          userId,
          socketId,
          username,
          createdAtMs,
        }),
        'EX',
        this.SEARCH_TTL_SECONDS,
      ),
    ]);

    this.logger.log(`User ${userId} joined ${mode} queue`);
    return { success: true };
  }

  /**
   * Removes a user from all queues.
   */
  async cancelSearch(userId: string, bypassCooldown = false): Promise<{ success: boolean; error?: string }> {
    if (!bypassCooldown) {
      const queueCooldownKey = `queue_toggle_cooldown:${userId}`;
      const setCooldown = await this.redisClient.set(queueCooldownKey, '1', 'EX', 2, 'NX');
      if (!setCooldown) {
        return { success: false, error: 'Please wait a moment before toggling queue status.' };
      }
    }

    await Promise.all([
      this.removeUserFromQueue('ranked', userId),
      this.removeUserFromQueue('unrated', userId),
      this.redisClient.del(this.queueSearchKey(userId)),
    ]);
    this.logger.log(`User ${userId} removed from all queues`);
    return { success: true };
  }

  private async removeUserFromQueue(mode: QueueMode, userId: string) {
    const { zset, members } = this.QUEUES[mode];
    await Promise.all([
      this.redisClient.zrem(zset, userId),
      this.redisClient.srem(members, userId),
    ]);
  }

  /**
   * Purges users who stayed in queue for >60 seconds and emits searchExpired.
   */
  private async purgeExpiredUsers(mode: QueueMode): Promise<void> {
    const { zset, members } = this.QUEUES[mode];
    const cutoff = Date.now() - this.SEARCH_TTL_SECONDS * 1000;

    const expiredUserIds = await this.redisClient.zrangebyscore(
      zset,
      '-inf',
      cutoff,
    );
    if (!expiredUserIds.length) return;

    // Notify users before purge so clients always stop searching on timeout.
    expiredUserIds.forEach((userId) => {
      this.server?.to(userId).emit('searchExpired', { mode });
    });

    const keys = expiredUserIds.map((id) => this.queueSearchKey(id));
    await this.redisClient.zremrangebyscore(zset, '-inf', cutoff);

    const multi = this.redisClient.multi();
    if (expiredUserIds.length > 0) {
      multi.srem(members, ...expiredUserIds);
      multi.del(...keys);
    }
    await multi.exec();
  }

  /**
   * Atomically claims the two oldest valid queued users (if any).
   */
  private async popValidPlayerPair(
    zset: string,
    members: string,
  ): Promise<[QueueEntry, QueueEntry] | null> {
    const script = `
local queueKey = KEYS[1]
local membersKey = KEYS[2]
local entries = redis.call('ZRANGE', queueKey, 0, 99)
local selected = {}

for _, userId in ipairs(entries) do
  local isMember = redis.call('SISMEMBER', membersKey, userId)
  if isMember == 1 then
    local raw = redis.call('GET', 'queue_search:' .. userId)
    if raw then
      table.insert(selected, raw)
      if #selected == 2 then
        break
      end
    else
      redis.call('SREM', membersKey, userId)
      redis.call('ZREM', queueKey, userId)
    end
  else
    redis.call('ZREM', queueKey, userId)
  end
end

if #selected < 2 then
  return {}
end

for _, raw in ipairs(selected) do
  local data = cjson.decode(raw)
  local userId = tostring(data.userId)
  redis.call('ZREM', queueKey, userId)
  redis.call('SREM', membersKey, userId)
  redis.call('DEL', 'queue_search:' .. userId)
end

return selected
`;

    const result = await this.redisClient.eval(script, 2, zset, members);
    if (!Array.isArray(result) || result.length < 2) {
      return null;
    }

    try {
      const p1 = JSON.parse(String(result[0])) as QueueEntry;
      const p2 = JSON.parse(String(result[1])) as QueueEntry;
      if (!p1?.userId || !p2?.userId || p1.userId === p2.userId) {
        return null;
      }
      return [p1, p2];
    } catch {
      return null;
    }
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
    config?: { composition: any[]; timerConfig: Record<string, number> },
  ): Promise<{ success: boolean; roomCode?: string; error?: string }> {
    const existingRoom = await this.redisClient.get(`user_room:${userId}`);
    if (existingRoom) {
      return { success: false, error: 'You already have an active private room. Cancel it first.' };
    }

    const isCoolingDown = await this.redisClient.get(`lobby_cancel_cooldown:${userId}`);
    if (isCoolingDown) {
      return { success: false, error: 'Please wait a moment before creating a new lobby.' };
    }

    let finalConfig = config;
    if (finalConfig) {
      if (!Array.isArray(finalConfig.composition) || finalConfig.composition.length === 0) {
        throw new Error('Composition must have at least 1 entry');
      }
      const validModes = ['STRIKES', 'TOP_10', 'PHOTO_GUESS', 'LINEUP'];
      for (const mode of finalConfig.composition) {
        if (!validModes.includes(mode)) {
          throw new Error('Invalid game mode in composition');
        }
      }
      const validTimers = [10000, 15000, 30000, 60000];
      for (const val of Object.values(finalConfig.timerConfig || {})) {
        if (!validTimers.includes(val as number)) {
          throw new Error('Invalid timer config value');
        }
      }
    } else {
      finalConfig = {
        composition: ['STRIKES', 'STRIKES', 'TOP_10'],
        timerConfig: { STRIKES: 10000, TOP_10: 10000 },
      };
    }

    // Cannot be in a queue and host a private room simultaneously
    await this.cancelSearch(userId, true);

    let roomCode = '';
    let isUnique = false;
    while (!isUnique) {
      roomCode = randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
      const exists = await this.redisClient.exists(`private_room:${roomCode}`);
      if (!exists) isUnique = true;
    }

    const TTL = 900; // 15 minutes
    const roomData = JSON.stringify({
      hostId: userId,
      hostUsername: username || userId,
      guestId: null,
      guestUsername: null,
      config: finalConfig,
      hostReady: false,
      guestReady: false,
      status: 'waiting_for_guest',
      createdAt: Date.now()
    });

    await Promise.all([
      this.redisClient.set(`private_room:${roomCode}`, roomData, 'EX', TTL),
      this.redisClient.set(`user_room:${userId}`, roomCode, 'EX', TTL),
      this.redisClient.zadd('private_rooms_expiry', Date.now() + 900000, roomCode),
    ]);

    this.logger.log(`Private room ${roomCode} created by user ${userId}`);
    return { success: true, roomCode };
  }

  /** Allows the host to cancel their own private room before anyone joins. */
  async cancelPrivateRoom(userId: string): Promise<{ success: boolean; error?: string }> {
    const cleanedRoomCode = await this.cleanupUserPrivateRoom(userId);

    // Only log if a room was actually found and deleted
    if (cleanedRoomCode) {
      await this.redisClient.set(`lobby_cancel_cooldown:${userId}`, '1', 'EX', 3);
      this.logger.log(
        `Private room ${cleanedRoomCode} cancelled by user ${userId}`,
      );
    }
    return { success: true };
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
      return null;
    }

    const privateRoomKey = `private_room:${roomCode}`;
    const multi = this.redisClient.multi();
    multi.del(privateRoomKey);
    multi.del(userRoomKey);
    multi.zrem('private_rooms_expiry', roomCode);
    await multi.exec();
    return roomCode;
  }

  /**
   * Joins an existing private room.
   * Modifies the room state to include the guest, and updates status.
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

    const roomData = JSON.parse(roomDataStr) as any;

    if (roomData.hostId === userId) {
      await this.redisClient.unwatch();
      return { success: false, error: 'You cannot join your own room' };
    }

    if (roomData.guestId || roomData.status !== 'waiting_for_guest') {
      await this.redisClient.unwatch();
      return { success: false, error: 'Room is already full' };
    }

    roomData.guestId = userId;
    roomData.guestUsername = username || userId;
    roomData.status = 'guest_joined';

    const multi = this.redisClient.multi();
    multi.set(privateRoomKey, JSON.stringify(roomData), 'KEEPTTL');
    multi.set(`user_room:${userId}`, uppercaseCode, 'KEEPTTL');

    const result = await multi.exec();

    if (!result) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Failed to join room, it might be full' };
    }

    await this.redisClient.unwatch().catch(() => {});

    // Both players must leave any public queue they were in
    await Promise.all([
      this.cancelSearch(roomData.hostId, true),
      this.cancelSearch(userId, true),
    ]);

    // Return the updated room data to the caller so they can emit updates
    return { success: true, roomData };
  }

  async toggleLobbyReady(userId: string): Promise<{ success: boolean; roomData?: any; error?: string }> {
    const roomCode = await this.redisClient.get(`user_room:${userId}`);
    if (!roomCode) return { success: false, error: 'You are not in a lobby' };

    const privateRoomKey = `private_room:${roomCode}`;
    await this.redisClient.watch(privateRoomKey);
    const roomDataStr = await this.redisClient.get(privateRoomKey);

    if (!roomDataStr) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Lobby not found' };
    }

    const roomData = JSON.parse(roomDataStr);
    let updated = false;

    if (roomData.hostId === userId) {
      roomData.hostReady = !roomData.hostReady;
      updated = true;
    } else if (roomData.guestId === userId) {
      roomData.guestReady = !roomData.guestReady;
      updated = true;
    }

    if (!updated) {
      await this.redisClient.unwatch();
      return { success: false, error: 'You are not a member of this lobby' };
    }

    if (roomData.hostReady && roomData.guestReady) {
      roomData.status = 'ready_to_start';
    } else {
      roomData.status = 'guest_joined';
    }

    const multi = this.redisClient.multi();
    multi.set(privateRoomKey, JSON.stringify(roomData), 'KEEPTTL');
    const result = await multi.exec();

    if (!result) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Conflict updating lobby state' };
    }

    await this.redisClient.unwatch().catch(() => {});
    return { success: true, roomData };
  }

  async leaveLobby(userId: string): Promise<{ success: boolean; roomData?: any; error?: string; isHost?: boolean }> {
    const roomCode = await this.redisClient.get(`user_room:${userId}`);
    if (!roomCode) return { success: false, error: 'You are not in a lobby' };

    const privateRoomKey = `private_room:${roomCode}`;
    await this.redisClient.watch(privateRoomKey);
    const roomDataStr = await this.redisClient.get(privateRoomKey);

    if (!roomDataStr) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Lobby not found' };
    }

    const roomData = JSON.parse(roomDataStr);

    if (roomData.hostId === userId) {
      // Host is leaving, cancel the lobby
      await this.redisClient.unwatch();
      await this.cancelPrivateRoom(userId);
      return { success: true, isHost: true, roomData };
    } else if (roomData.guestId === userId) {
      // Guest is leaving
      roomData.guestId = null;
      roomData.guestUsername = null;
      roomData.guestReady = false;
      roomData.status = 'waiting_for_guest';

      const multi = this.redisClient.multi();
      multi.set(privateRoomKey, JSON.stringify(roomData), 'KEEPTTL');
      multi.del(`user_room:${userId}`);
      const result = await multi.exec();

      if (!result) {
        await this.redisClient.unwatch();
        return { success: false, error: 'Conflict updating lobby state' };
      }

      await this.redisClient.unwatch().catch(() => {});
      return { success: true, isHost: false, roomData };
    }

    await this.redisClient.unwatch();
    return { success: false, error: 'Not a member of this lobby' };
  }

  async startLobbyMatch(userId: string): Promise<{ success: boolean; gameSessionId?: string; roomData?: any; gameState?: any; error?: string }> {
    const roomCode = await this.redisClient.get(`user_room:${userId}`);
    if (!roomCode) return { success: false, error: 'You are not in a lobby' };

    const privateRoomKey = `private_room:${roomCode}`;
    await this.redisClient.watch(privateRoomKey);
    const roomDataStr = await this.redisClient.get(privateRoomKey);

    if (!roomDataStr) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Lobby not found' };
    }

    const roomData = JSON.parse(roomDataStr);

    if (roomData.hostId !== userId) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Only the host can start the match' };
    }

    if (roomData.status !== 'ready_to_start') {
      await this.redisClient.unwatch();
      return { success: false, error: 'Both players must be ready' };
    }

    // Atomically consume room
    const multi = this.redisClient.multi();
    multi.del(privateRoomKey);
    multi.del(`user_room:${roomData.hostId}`);
    multi.del(`user_room:${roomData.guestId}`);
    multi.zrem('private_rooms_expiry', roomCode);
    const result = await multi.exec();

    if (!result) {
      await this.redisClient.unwatch();
      return { success: false, error: 'Conflict starting match' };
    }

    await this.redisClient.unwatch().catch(() => {});

    const gameSessionId = randomUUID();
    const gameState = await this.initializeGameState(
      gameSessionId,
      roomData.hostId,
      roomData.guestId,
      roomData.hostUsername,
      roomData.guestUsername,
      false, // private matches are unrated
      roomData.config?.composition,
      roomData.config?.timerConfig
    );

    return { success: true, gameSessionId, roomData, gameState };
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
    const { zset, members } = this.QUEUES[mode];

    await this.purgeExpiredUsers(mode);

    const queueLength = await this.redisClient.zcard(zset);
    if (queueLength < 2) return;

    const pair = await this.popValidPlayerPair(zset, members);
    if (!pair) return;
    const [p1, p2] = pair;

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
    composition: any[] = ['STRIKES', 'STRIKES', 'TOP_10'],
    timerConfig?: Record<string, number>
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
      // ── Envelope (mode-agnostic) ──────────────────────────────────────────
      players: [player1Id, player2Id],
      status: 'in_progress',
      winner: null,
      isRanked,
      composition,
      timerConfig: timerConfig || { STRIKES: 10_000, TOP_10: 10_000 },
      mode: composition[0],
      playerNames: {
        [player1Id]: player1Username ?? String(player1Id),
        [player2Id]: player2Username ?? String(player2Id),
      },
      playerMmr: {
        [player1Id]: p1Mmr,
        [player2Id]: p2Mmr,
      },
      // ── Mode-specific state ────────────────
      modeState: {
        currentRound: 1,
        roundWinnerId: null as string | null,
        overallScores: { [player1Id]: 0, [player2Id]: 0 },
        roundHistory: [] as any[],
        usedQuestionIds: [] as string[],
        currentQuestion: null as any,
      },
    };

    const modeClass = gameState.mode === 'TOP_10' 
      ? require('./top10-mode.strategy').Top10ModeStrategy
      : require('./strikes-mode.strategy').StrikesModeStrategy;
    const strategy = new modeClass();
    strategy.initializeRoundState(gameState);

    const firstQuestion = await this.gameService.getRandomQuestion(gameState.mode);
    gameState.modeState.currentQuestion = firstQuestion;
    if (firstQuestion) {
      gameState.modeState.usedQuestionIds.push(firstQuestion.id);
    }
    const gameKey = `game:${gameSessionId}`;
    const stateJson = JSON.stringify(gameState);
    const multi = this.redisClient.multi();
    multi.set(gameKey, stateJson);
    this.setActiveGameSessionIdInMulti(multi, player1Id, gameSessionId);
    this.setActiveGameSessionIdInMulti(multi, player2Id, gameSessionId);
    await multi.exec();
    return gameState;

  }

  /**
   * Queues DELs for active-game user mappings inside an existing MULTI.
   * Also clears legacy keys for safe rolling migration.
   */
  deleteActiveGameKeysInMulti(
    multi: ChainableCommander,
    playerIds: Array<string | number | undefined | null>,
  ): void {
    for (const raw of playerIds) {
      if (raw === undefined || raw === null) continue;
      const id = String(raw);
      if (!id) continue;
      multi.del(this.activeGameKey(id));
      multi.del(`active_game:${id}`);
    }
  }

  setActiveGameSessionIdInMulti(
    multi: ChainableCommander,
    userId: string,
    gameSessionId: string,
  ): void {
    const key = this.activeGameKey(String(userId));
    // 6-hour safety-net TTL — only fires if the server crashes mid-match;
    // normal match endings always delete the key explicitly.
    multi.set(key, String(gameSessionId));
    multi.expire(key, 6 * 60 * 60);
  }

  async setActiveGameSessionIdForUser(
    userId: string,
    gameSessionId: string,
  ): Promise<void> {
    // 6-hour safety-net TTL prevents permanent orphaned locks after a server crash.
    await this.redisClient.set(
      this.activeGameKey(String(userId)),
      String(gameSessionId),
      'EX',
      6 * 60 * 60,
    );
  }

  /**
   * Returns the user's current in-progress game session id from Redis, or null.
   */
  async getActiveGameSessionIdForUser(userId: string): Promise<string | null> {
    const uid = String(userId);
    const key = this.activeGameKey(uid);
    let sessionId = await this.redisClient.get(key);
    if (!sessionId) {
      const legacyKey = `active_game:${uid}`;
      const legacySessionId = await this.redisClient.get(legacyKey);
      if (!legacySessionId) return null;
      sessionId = legacySessionId;
      const multi = this.redisClient.multi();
      multi.set(key, sessionId);
      multi.del(legacyKey);
      await multi.exec().catch(() => {});
    }

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

  /**
   * Applies Elo rating changes to both players after a ranked match ends in a draw.
   * Also increments gamesPlayed for both.
   */
  async updateMmrAfterDraw(
    playerAId: string,
    playerBId: string,
  ): Promise<{ deltaA: number; deltaB: number } | null> {
    try {
      const [playerA, playerB] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: playerAId },
          select: { mmr: true },
        }),
        this.prisma.user.findUnique({
          where: { id: playerBId },
          select: { mmr: true },
        }),
      ]);

      if (!playerA || !playerB) {
        this.logger.warn(
          `MMR draw update skipped — playerA=${playerAId} found=${!!playerA}, playerB=${playerBId} found=${!!playerB}`,
        );
        return null;
      }

      const { newMmrA, newMmrB, deltaA, deltaB } = calculateEloDraw(
        playerA.mmr,
        playerB.mmr,
        32,
      );

      await Promise.all([
        this.prisma.user.update({
          where: { id: playerAId },
          data: {
            mmr: newMmrA,
            gamesPlayed: { increment: 1 },
          },
        }),
        this.prisma.user.update({
          where: { id: playerBId },
          data: {
            mmr: newMmrB,
            gamesPlayed: { increment: 1 },
          },
        }),
      ]);

      this.logger.log(
        `MMR updated (draw) — playerA ${playerAId}: ${playerA.mmr} → ${newMmrA} (${deltaA > 0 ? '+' : ''}${deltaA}), ` +
          `playerB ${playerBId}: ${playerB.mmr} → ${newMmrB} (${deltaB > 0 ? '+' : ''}${deltaB})`,
      );

      return { deltaA, deltaB };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`MMR draw update failed: ${err?.message}`, err?.stack);
      return null;
    }
  }
}
