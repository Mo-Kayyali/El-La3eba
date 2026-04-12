import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';

@ApiTags('Friends')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @ApiOperation({ summary: 'Send a friend request by UUID or username' })
  @Post('request')
  sendFriendRequest(
    @Request() req: { user: { userId: string } },
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friendsService.sendFriendRequest(
      req.user.userId,
      dto.identifier,
    );
  }

  @ApiOperation({ summary: 'Accept a pending friend request' })
  @Post(':requestId/accept')
  acceptFriendRequest(
    @Request() req: { user: { userId: string } },
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.acceptFriendRequest(req.user.userId, requestId);
  }

  @ApiOperation({ summary: 'Reject a pending friend request' })
  @Post(':requestId/reject')
  rejectFriendRequest(
    @Request() req: { user: { userId: string } },
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.rejectFriendRequest(req.user.userId, requestId);
  }

  @ApiOperation({ summary: 'Cancel your outgoing friend request' })
  @Post(':requestId/cancel')
  cancelOutgoingRequest(
    @Request() req: { user: { userId: string } },
    @Param('requestId') requestId: string,
  ) {
    return this.friendsService.cancelOutgoingRequest(
      req.user.userId,
      requestId,
    );
  }

  @ApiOperation({ summary: 'Remove an accepted friend' })
  @Post(':friendshipId/remove')
  removeFriend(
    @Request() req: { user: { userId: string } },
    @Param('friendshipId') friendshipId: string,
  ) {
    return this.friendsService.removeFriend(req.user.userId, friendshipId);
  }

  @ApiOperation({ summary: 'List friends and pending requests' })
  @Get()
  listFriends(@Request() req: { user: { userId: string } }) {
    return this.friendsService.getFriendsList(req.user.userId);
  }
}
