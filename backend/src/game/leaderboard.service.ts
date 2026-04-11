import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface LeaderboardEntry {
  id: string;
  username: string;
  mmr: number;
  wins: number;
  gamesPlayed: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  /** Redis key where the cached leaderboard JSON is stored. */
  static readonly CACHE_KEY = 'global_leaderboard';

  /** Cache TTL in seconds — 2 hours, so a cache miss between hourly refreshes is covered. */
  private readonly CACHE_TTL = 7200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisClient: RedisService,
  ) {}

  /**
   * Runs every hour and refreshes the top-10 leaderboard in Redis.
   * The frontend can read `global_leaderboard` from Redis (via a future REST endpoint)
   * without touching PostgreSQL on every request.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshLeaderboard(): Promise<void> {
    try {
      const topUsers = await this.prisma.user.findMany({
        orderBy: { mmr: 'desc' },
        take: 10,
        select: {
          id: true,
          username: true,
          mmr: true,
          wins: true,
          gamesPlayed: true,
        },
      });

      await this.redisClient.set(
        LeaderboardService.CACHE_KEY,
        JSON.stringify(topUsers),
        'EX',
        this.CACHE_TTL,
      );

      this.logger.log(
        `Leaderboard refreshed — ${topUsers.length} entries cached (top MMR: ${topUsers[0]?.mmr ?? 'n/a'})`,
      );
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(
        `Failed to refresh leaderboard: ${err?.message}`,
        err?.stack,
      );
    }
  }

  /**
   * Returns the cached top-10 leaderboard.
   * On a cache miss (first boot, Redis flush) it immediately queries the DB
   * and primes the cache before returning.
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const cached = await this.redisClient.get(LeaderboardService.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as LeaderboardEntry[];
    }

    // Cache miss — hydrate on demand
    this.logger.warn('Leaderboard cache miss — querying DB directly');
    await this.refreshLeaderboard();

    const fresh = await this.redisClient.get(LeaderboardService.CACHE_KEY);
    return fresh ? (JSON.parse(fresh) as LeaderboardEntry[]) : [];
  }
}
