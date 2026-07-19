import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Req } from '@nestjs/common';
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
  create(@Body() createDto: CreatePlayerDto, @Req() req: any) {
    return this.playersService.create(createDto, req.user.userId);
  }

  @Get()
  findAll(
    @Query('competitionId') competitionId?: string,
    @Query('compCountryCode') compCountryCode?: string,
    @Query('clubId') clubId?: string,
    @Query('isRetired') isRetired?: string,
    @Query('nationality') nationality?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.playersService.findAll({ 
      competitionId, compCountryCode, clubId, isRetired, nationality, search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
      sort, order,
    });
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
  update(@Param('id') id: string, @Body() updateDto: PatchPlayerDto, @Req() req: any) {
    return this.playersService.update(id, updateDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.playersService.remove(id);
  }
}
