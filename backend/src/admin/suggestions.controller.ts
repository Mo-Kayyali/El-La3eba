import { Controller, Get, Post, Param, Body, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { SuggestionsService } from './suggestions.service';

@ApiTags('Admin Suggestions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Get()
  @ApiOperation({ summary: 'List suggestions' })
  async getAllSuggestions(@Query('status') status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    return this.suggestionsService.getAllSuggestions(status);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a suggestion' })
  async approveSuggestion(
    @Param('id') id: string,
    @Body() body: { reviewNote?: string },
  ) {
    return this.suggestionsService.approveSuggestion(id, body.reviewNote);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a suggestion' })
  async rejectSuggestion(
    @Param('id') id: string,
    @Body() body: { reviewNote?: string },
  ) {
    return this.suggestionsService.rejectSuggestion(id, body.reviewNote);
  }
}
