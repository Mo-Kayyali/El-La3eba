import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { FriendshipStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { GameGateway } from '../game/game.gateway';

type FriendshipWithUsers = Prisma.FriendshipGetPayload<{
  include: { user: true; friend: true };
}>;

type PresenceStatus = 'offline' | 'online' | 'in-game';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisClient: RedisService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  private async resolveUserByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { id: identifier },
          { username: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true },
    });
  }

  private async getPresenceStatus(userId: string): Promise<{
    status: PresenceStatus;
    gameSessionId: string | null;
  }> {
    const raw = await this.redisClient.hget('presence', userId);
    if (!raw) return { status: 'offline', gameSessionId: null };
    if (raw.startsWith('in-game:')) {
      return { status: 'in-game', gameSessionId: raw.slice('in-game:'.length) };
    }
    return { status: 'online', gameSessionId: null };
  }

  private mapFriendship(
    friendship: FriendshipWithUsers,
    currentUserId: string,
  ) {
    const otherUser =
      friendship.userId === currentUserId ? friendship.friend : friendship.user;

    return {
      friendshipId: friendship.id,
      userId: otherUser.id,
      username: otherUser.username,
      status: friendship.status,
      createdAt: friendship.createdAt,
    };
  }

  async sendFriendRequest(requesterId: string, identifier: string) {
    if (!identifier?.trim()) {
      throw new BadRequestException('Provide a username or UUID');
    }

    const target = await this.resolveUserByIdentifier(identifier.trim());
    if (!target) {
      throw new NotFoundException('User not found');
    }

    if (target.id === requesterId) {
      throw new BadRequestException('You cannot friend yourself');
    }

    const [existingOutgoing, existingIncoming] = await Promise.all([
      this.prisma.friendship.findUnique({
        where: {
          userId_friendId: { userId: requesterId, friendId: target.id },
        },
      }),
      this.prisma.friendship.findUnique({
        where: {
          userId_friendId: { userId: target.id, friendId: requesterId },
        },
      }),
    ]);

    const duplicateFriendshipMessage =
      'You are already friends or have a pending request.';

    if (
      existingOutgoing?.status === FriendshipStatus.ACCEPTED ||
      existingIncoming?.status === FriendshipStatus.ACCEPTED
    ) {
      throw new ConflictException(duplicateFriendshipMessage);
    }

    if (existingOutgoing?.status === FriendshipStatus.PENDING) {
      throw new ConflictException(duplicateFriendshipMessage);
    }

    if (existingIncoming?.status === FriendshipStatus.PENDING) {
      const accepted = await this.prisma.friendship.update({
        where: { id: existingIncoming.id },
        data: { status: FriendshipStatus.ACCEPTED },
        include: { user: true, friend: true },
      });

      return {
        created: false,
        accepted: true,
        friendship: this.mapFriendship(accepted, requesterId),
      };
    }

    const created = await this.prisma.friendship.create({
      data: {
        userId: requesterId,
        friendId: target.id,
        status: FriendshipStatus.PENDING,
      },
      include: { user: true, friend: true },
    });

    this.gameGateway.emitFriendRequestReceived(target.id, {
      requestId: created.id,
      senderId: requesterId,
      senderUsername: created.user.username,
      createdAt: created.createdAt.toISOString(),
    });

    return {
      created: true,
      accepted: false,
      friendship: this.mapFriendship(created, requesterId),
    };
  }

  async acceptFriendRequest(currentUserId: string, requestId: string) {
    const request = await this.prisma.friendship.findFirst({
      where: { id: requestId, friendId: currentUserId },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    if (request.status === FriendshipStatus.ACCEPTED) {
      return { accepted: true };
    }

    await this.prisma.friendship.update({
      where: { id: request.id },
      data: { status: FriendshipStatus.ACCEPTED },
    });

    return { accepted: true };
  }

  async rejectFriendRequest(currentUserId: string, requestId: string) {
    const request = await this.prisma.friendship.findFirst({
      where: {
        id: requestId,
        friendId: currentUserId,
        status: FriendshipStatus.PENDING,
      },
    });

    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.friendship.delete({ where: { id: request.id } });
    return { rejected: true };
  }

  async cancelOutgoingRequest(currentUserId: string, requestId: string) {
    const request = await this.prisma.friendship.findFirst({
      where: {
        id: requestId,
        userId: currentUserId,
        status: FriendshipStatus.PENDING,
      },
    });

    if (!request) {
      throw new NotFoundException('Outgoing friend request not found');
    }

    await this.prisma.friendship.delete({ where: { id: request.id } });
    return { cancelled: true };
  }

  async removeFriend(currentUserId: string, friendshipId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        id: friendshipId,
        status: FriendshipStatus.ACCEPTED,
        OR: [{ userId: currentUserId }, { friendId: currentUserId }],
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.prisma.friendship.delete({ where: { id: friendship.id } });
    return { removed: true };
  }

  async getFriendsList(currentUserId: string) {
    const [friendships, incomingRequests, outgoingRequests] = await Promise.all(
      [
        this.prisma.friendship.findMany({
          where: {
            status: FriendshipStatus.ACCEPTED,
            OR: [{ userId: currentUserId }, { friendId: currentUserId }],
          },
          include: { user: true, friend: true },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.friendship.findMany({
          where: { friendId: currentUserId, status: FriendshipStatus.PENDING },
          include: { user: true, friend: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.friendship.findMany({
          where: { userId: currentUserId, status: FriendshipStatus.PENDING },
          include: { user: true, friend: true },
          orderBy: { createdAt: 'desc' },
        }),
      ],
    );

    const friends = await Promise.all(
      friendships.map(async (friendship) => {
        const base = this.mapFriendship(friendship, currentUserId);
        const presence = await this.getPresenceStatus(base.userId);
        return { ...base, presence };
      }),
    );

    const incoming = incomingRequests.map((friendship) =>
      this.mapFriendship(friendship, currentUserId),
    );
    const outgoing = outgoingRequests.map((friendship) =>
      this.mapFriendship(friendship, currentUserId),
    );

    return { friends, incomingRequests: incoming, outgoingRequests: outgoing };
  }

  async getFriendPresenceSnapshot(currentUserId: string) {
    const list = await this.getFriendsList(currentUserId);
    return list.friends.map((friend) => ({
      userId: friend.userId,
      username: friend.username,
      status: friend.presence.status,
      gameSessionId: friend.presence.gameSessionId,
    }));
  }

  async ensureUsersAreFriends(userId: string, otherUserId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: FriendshipStatus.ACCEPTED,
        OR: [
          { userId, friendId: otherUserId },
          { userId: otherUserId, friendId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new BadRequestException('You can only invite accepted friends');
    }
  }
}
