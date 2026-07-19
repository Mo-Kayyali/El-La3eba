import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private prisma: PrismaService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test endpoint to verify admin roles guard' })
  @Roles(Role.ADMIN)
  @Get('ping')
  ping() {
    return { ok: true, message: 'Admin access verified' };
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all countries for dropdowns' })
  @Roles(Role.ADMIN)
  @Get('countries')
  getCountries() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }
}
