import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get public profile by user id' })
  @Get('profile/:id')
  getPublicProfile(@Param('id') userId: string) {
    return this.usersService.getPublicProfileById(userId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateOwnProfile(
    @Request() req: { user: { userId: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateOwnProfile(req.user.userId, dto);
  }
}
