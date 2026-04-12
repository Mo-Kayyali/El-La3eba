import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

type PrismaErrorLike = {
  code?: string;
  meta?: {
    target?: unknown;
  };
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private penaltyKey(userId: string) {
    return `penalty:${userId}`;
  }

  async recordOfflinePenalty(
    userId: string,
    gameSessionId: string,
    mmrLost: number,
  ) {
    const now = new Date();
    const safeMmrLost = Math.max(0, Math.round(mmrLost));

    const penalty = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          offlineDisconnectCount: { increment: 1 },
          lastDisconnectAt: now,
        },
      });

      return tx.offlinePenalty.create({
        data: {
          userId,
          gameSessionId,
          mmrLost: safeMmrLost,
        },
      });
    });

    await this.redis.set(
      this.penaltyKey(userId),
      JSON.stringify({
        id: penalty.id,
        mmrLost: penalty.mmrLost,
        gameSessionId: penalty.gameSessionId,
        createdAt: penalty.createdAt.toISOString(),
      }),
      'EX',
      60 * 60 * 24 * 7,
    );

    return penalty;
  }

  async getPendingOfflinePenalty(userId: string): Promise<{
    id: string;
    mmrLost: number;
    gameSessionId: string;
    createdAt: string;
  } | null> {
    const cached = await this.redis.get(this.penaltyKey(userId));
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
        await this.redis.del(this.penaltyKey(userId)).catch(() => 0);
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

    await this.redis.set(
      this.penaltyKey(userId),
      JSON.stringify(payload),
      'EX',
      60 * 60 * 24 * 7,
    );

    return payload;
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

    await this.redis.del(this.penaltyKey(userId)).catch(() => 0);

    return {
      success: true,
      cleared: result.count,
    };
  }

  async getPublicProfileById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        gamesPlayed: true,
        wins: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto) {
    const hasAnyField =
      dto.username !== undefined ||
      dto.email !== undefined ||
      dto.password !== undefined;

    if (!hasAnyField) {
      throw new BadRequestException('Provide at least one field to update');
    }

    const data: {
      username?: string;
      email?: string;
      passwordHash?: string;
    } = {};

    if (dto.username !== undefined) data.username = dto.username;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.password !== undefined) {
      const salt = await bcrypt.genSalt();
      data.passwordHash = await bcrypt.hash(dto.password, salt);
    }

    try {
      const updatedUser = await this.prisma.$transaction(async (tx) => {
        return tx.user.update({
          where: { id: userId },
          data,
          select: {
            id: true,
            username: true,
            email: true,
            mmr: true,
            wins: true,
            gamesPlayed: true,
            isVerified: true,
            createdAt: true,
          },
        });
      });

      return updatedUser;
    } catch (err: unknown) {
      const prismaErr = err as PrismaErrorLike;

      if (prismaErr.code === 'P2025') {
        throw new NotFoundException('User not found');
      }

      if (prismaErr.code === 'P2002') {
        const targets = Array.isArray(prismaErr.meta?.target)
          ? (prismaErr.meta?.target as string[])
          : [];

        if (targets.includes('username')) {
          throw new BadRequestException('Username already exists');
        }

        if (targets.includes('email')) {
          throw new BadRequestException('Email already exists');
        }

        throw new BadRequestException('Username or email already exists');
      }

      throw new InternalServerErrorException('Failed to update profile');
    }
  }
}
