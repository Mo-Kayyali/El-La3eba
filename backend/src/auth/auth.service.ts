import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  private penaltyKey(userId: string) {
    return `penalty:${userId}`;
  }

  private activeGameKey(userId: string) {
    return `user_active_game:${userId}`;
  }

  private activeLobbyKey(userId: string) {
    return `user_active_lobby:${userId}`;
  }

  private async getPendingOfflinePenalty(userId: string): Promise<{
    id: string;
    mmrLost: number;
    gameSessionId: string;
    createdAt: string;
  } | null> {
    const cached = await this.redisService.get(this.penaltyKey(userId));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          id: string;
          mmrLost: number;
          gameSessionId: string;
          createdAt: string;
        };
        if (parsed?.id && parsed?.gameSessionId) {
          return parsed;
        }
      } catch {
        await this.redisService.del(this.penaltyKey(userId)).catch(() => 0);
      }
    }

    const penalty = await this.prisma.offlinePenalty.findFirst({
      where: {
        userId,
        acknowledgedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!penalty) return null;

    const payload = {
      id: penalty.id,
      mmrLost: penalty.mmrLost,
      gameSessionId: penalty.gameSessionId,
      createdAt: penalty.createdAt.toISOString(),
    };

    await this.redisService.set(
      this.penaltyKey(userId),
      JSON.stringify(payload),
      'EX',
      60 * 60 * 24 * 7,
    );

    return payload;
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { username: dto.username }],
      },
    });

    if (existingUser) {
      throw new ConflictException('Username or Email already exists');
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
      },
    });

    return this.generateToken(user, false);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user, dto.rememberMe === true);
  }

  async getProfileById(userId: string) {
    const [
      user,
      pendingIncomingFriendRequests,
      pendingOfflinePenalty,
      activeGameSessionId,
      activeLobbyRoomCode,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          mmr: true,
          wins: true,
          gamesPlayed: true,
          isVerified: true,
          createdAt: true,
          offlineDisconnectCount: true,
          lastDisconnectAt: true,
          role: true,
        },
      }),
      this.prisma.friendship.count({
        where: {
          friendId: userId,
          status: FriendshipStatus.PENDING,
        },
      }),
      this.getPendingOfflinePenalty(userId),
      (async () => {
        const primary = await this.redisService.get(this.activeGameKey(userId));
        if (primary) return primary;
        const legacy = await this.redisService.get(`active_game:${userId}`);
        if (!legacy) return null;
        await this.redisService
          .multi()
          .set(this.activeGameKey(userId), legacy)
          .del(`active_game:${userId}`)
          .exec()
          .catch(() => null);
        return legacy;
      })(),
      (async () => {
        const roomCode = await this.redisService.get(
          this.activeLobbyKey(userId),
        );
        return roomCode || null;
      })(),
    ]);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      ...user,
      activeGameSessionId,
      activeLobbyRoomCode,
      pendingIncomingFriendRequests,
      pendingOfflinePenalty,
    };
  }

  async acknowledgeOfflinePenalty(userId: string) {
    const acknowledgedAt = new Date();
    const result = await this.prisma.offlinePenalty.updateMany({
      where: {
        userId,
        acknowledgedAt: null,
      },
      data: { acknowledgedAt },
    });
    await this.redisService.del(this.penaltyKey(userId)).catch(() => 0);
    return {
      success: true,
      cleared: result.count,
    };
  }

  private generateToken(user: any, rememberMe = false) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };
    const expiresIn = rememberMe ? '30d' : '1d';
    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isVerified: user.isVerified,
        mmr: user.mmr,
      },
    };
  }

  async requestVerification(userId: string, email: string) {
    // Rate limit: one verification request per 60 seconds per user.
    const cooldownKey = `verify_email_cooldown:${userId}`;
    const allowed = await this.redisService.set(
      cooldownKey,
      '1',
      'EX',
      60,
      'NX',
    );
    if (allowed !== 'OK') {
      throw new HttpException(
        'Please wait 60 seconds before requesting another verification code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const key = `verify_email:${userId}`;

    // Store in Redis with 15 mins (900 seconds) TTL
    await this.redisService.set(key, code, 'EX', 900);

    // Simulate sending email
    console.log(`[SIMULATED EMAIL] To: ${email} - Verification Code: ${code}`);

    return {
      success: true,
      message: 'Verification code generated and "sent" via email.',
    };
  }

  async verifyEmail(userId: string, code: string) {
    const key = `verify_email:${userId}`;

    // Atomically read and delete the code in one round-trip.
    // Two concurrent verify calls cannot both succeed on the same code:
    // the second will get nil because the first already consumed it.
    const storedCode = (await (this.redisService as any).eval(
      `local v = redis.call('GET', KEYS[1])\nif v then redis.call('DEL', KEYS[1]) end\nreturn v`,
      1,
      key,
    )) as string | null;

    if (!storedCode) {
      throw new UnauthorizedException(
        'Verification code expired or not found.',
      );
    }

    if (storedCode !== code) {
      throw new UnauthorizedException('Invalid verification code.');
    }

    // Code matches, update user
    await this.prisma.user.update({
      where: { id: userId },
      data: { isVerified: true },
    });

    return { success: true, message: 'Email successfully verified.' };
  }
}
