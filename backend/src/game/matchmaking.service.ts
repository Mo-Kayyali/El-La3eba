import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { Server } from 'socket.io';
import { randomUUID, randomBytes } from 'crypto';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);
  private server: Server;

  constructor(private readonly redisClient: RedisService) {}

  setServer(server: Server) {
    this.server = server;
  }

  async joinQueue(userId: string, socketId: string) {
    const queueData = JSON.stringify({ userId, socketId });
    await this.redisClient.lpush('matchmaking_queue', queueData);
    this.logger.log(`User ${userId} joined matchmaking queue`);
  }

  async leaveQueue(userId: string) {
    // Note: It's hard to remove a specific user from a list by value if it's JSON stringified
    // For a robust production app, we would use a Redis Sorted Set or Hash to manage queue entries
    // For now, we will stick to the basic queue list but log the attempt.
    this.logger.log(`User ${userId} requested to leave matchmaking queue`);
  }

  @Interval(2000)
  async handleMatchmakingInterval() {
    if (!this.server) return;

    const queueLength = await this.redisClient.llen('matchmaking_queue');
    if (queueLength >= 2) {
      const player1Str = await this.redisClient.rpop('matchmaking_queue');
      const player2Str = await this.redisClient.rpop('matchmaking_queue');

      if (player1Str && player2Str) {
        const p1 = JSON.parse(player1Str);
        const p2 = JSON.parse(player2Str);
        
        // Ensure they aren't the exact same user queuing twice in a row before starting
        if (p1.userId === p2.userId) {
          await this.redisClient.lpush('matchmaking_queue', player1Str);
          return;
        }

        const gameSessionId = randomUUID();
        
        this.server.to(p1.socketId).emit('matchFound', { gameSessionId });
        this.server.to(p2.socketId).emit('matchFound', { gameSessionId });

        this.logger.log(`Match created: ${gameSessionId} [${p1.userId} vs ${p2.userId}]`);
      } else {
        if (player1Str) await this.redisClient.lpush('matchmaking_queue', player1Str);
        if (player2Str) await this.redisClient.lpush('matchmaking_queue', player2Str);
      }
    }
  }

  async createPrivateRoom(userId: string, socketId: string): Promise<string> {
    let roomCode = '';
    let isUnique = false;

    while (!isUnique) {
      roomCode = randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
      const exists = await this.redisClient.exists(`private_room:${roomCode}`);
      if (!exists) {
        isUnique = true;
      }
    }

    const roomData = JSON.stringify({ userId, socketId });
    // Expires in 30 minutes (1800 seconds)
    await this.redisClient.set(`private_room:${roomCode}`, roomData, 'EX', 1800);
    this.logger.log(`Private room ${roomCode} created by user ${userId}`);
    return roomCode;
  }

  async joinPrivateRoom(code: string, userId: string, socketId: string) {
    const uppercaseCode = code.toUpperCase();
    const roomDataStr = await this.redisClient.get(`private_room:${uppercaseCode}`);

    if (!roomDataStr) {
      return { success: false, error: 'Room not found or expired' };
    }

    const host = JSON.parse(roomDataStr);
    
    if (host.userId === userId) {
      return { success: false, error: 'You cannot join your own room' };
    }

    const gameSessionId = randomUUID();

    // Remove the room key to prevent others from joining
    await this.redisClient.del(`private_room:${uppercaseCode}`);

    if (this.server) {
        this.server.to(host.socketId).emit('matchFound', { gameSessionId });
        this.server.to(socketId).emit('matchFound', { gameSessionId });
    }

    this.logger.log(`Private match created: ${gameSessionId} [${host.userId} vs ${userId}]`);
    return { success: true, gameSessionId };
  }
}
