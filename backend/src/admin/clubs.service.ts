import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateClubDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsString()
  countryCode: string;

  @IsOptional()
  @IsUUID()
  currentCompetitionId?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateClubDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsUUID()
  currentCompetitionId?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

@Injectable()
export class AdminClubsService {
  constructor(private prisma: PrismaService) {}

  private async validateFks(countryCode?: string, currentCompetitionId?: string) {
    if (countryCode) {
      const country = await this.prisma.country.findUnique({ where: { id: countryCode } });
      if (!country) throw new BadRequestException(`Country code '${countryCode}' does not exist.`);
    }
    if (currentCompetitionId) {
      const comp = await this.prisma.competition.findUnique({ where: { id: currentCompetitionId } });
      if (!comp) throw new BadRequestException(`Competition ID '${currentCompetitionId}' does not exist.`);
    }
  }

  async findAll() {
    return this.prisma.club.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const club = await this.prisma.club.findUnique({ where: { id } });
    if (!club) throw new NotFoundException('Club not found');
    return club;
  }

  async create(dto: CreateClubDto) {
    await this.validateFks(dto.countryCode, dto.currentCompetitionId);
    return this.prisma.club.create({ data: dto });
  }

  async update(id: string, dto: UpdateClubDto) {
    await this.findOne(id);
    await this.validateFks(dto.countryCode, dto.currentCompetitionId);
    return this.prisma.club.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.club.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new ConflictException('Cannot delete: this club is still referenced by other records (e.g., players).');
      }
      throw error;
    }
  }
}
