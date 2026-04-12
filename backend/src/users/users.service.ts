import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

type PrismaErrorLike = {
  code?: string;
  meta?: {
    target?: unknown;
  };
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfileById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
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
