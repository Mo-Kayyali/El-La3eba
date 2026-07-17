import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { AdminPlayersService, CreatePlayerDto, PatchPlayerDto } from './players.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/players')
export class AdminPlayersController {
  constructor(private readonly playersService: AdminPlayersService) {}

  @Post()
  create(@Body() createDto: CreatePlayerDto) {
    return this.playersService.create(createDto);
  }

  @Get()
  findAll(
    @Query('competitionId') competitionId?: string,
    @Query('compCountryCode') compCountryCode?: string,
    @Query('clubId') clubId?: string,
    @Query('isRetired') isRetired?: string,
    @Query('nationality') nationality?: string,
  ) {
    return this.playersService.findAll({ competitionId, compCountryCode, clubId, isRetired, nationality });
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.playersService.search(q);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.playersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: PatchPlayerDto) {
    return this.playersService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.playersService.remove(id);
  }
}
