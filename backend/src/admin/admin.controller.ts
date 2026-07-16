import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test endpoint to verify admin roles guard' })
  @Roles(Role.ADMIN)
  @Get('ping')
  ping() {
    return { ok: true, message: 'Admin access verified' };
  }
}
