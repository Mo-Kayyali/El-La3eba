import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetitionType, Region } from '@prisma/client';

import { IsString, IsOptional, IsEnum, IsInt } from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  name: string;

  @IsEnum(CompetitionType)
  type: CompetitionType;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @IsOptional()
  @IsInt()
  tier?: number;
}

export class UpdateCompetitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CompetitionType)
  type?: CompetitionType;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsEnum(Region)
  region?: Region;

  @IsOptional()
  @IsInt()
  tier?: number;
}

@Injectable()
export class AdminCompetitionsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.competition.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const comp = await this.prisma.competition.findUnique({ where: { id } });
    if (!comp) throw new NotFoundException('Competition not found');
    return comp;
  }

  private validateRules(type: CompetitionType, countryCode?: string | null, region?: Region | null) {
    if (
      ([
        CompetitionType.DOMESTIC_LEAGUE,
        CompetitionType.DOMESTIC_CUP,
        CompetitionType.DOMESTIC_SUPER_CUP,
      ] as CompetitionType[]).includes(type)
    ) {
      if (!countryCode) throw new BadRequestException('Domestic competitions require a countryCode.');
      if (region) throw new BadRequestException('Domestic competitions cannot have a region.');
    } else if (
      ([
        CompetitionType.CONTINENTAL_CLUB_COMPETITION,
        CompetitionType.CONTINENTAL_SUPER_CUP,
      ] as CompetitionType[]).includes(type)
    ) {
      if (!region || region === Region.WORLD) {
        throw new BadRequestException('Continental competitions require a valid continent region (not WORLD).');
      }
      if (countryCode) throw new BadRequestException('Continental competitions cannot have a countryCode.');
    } else if (
      ([
        CompetitionType.INTERNATIONAL_TOURNAMENT,
        CompetitionType.GLOBAL_CLUB_CHAMPIONSHIP,
      ] as CompetitionType[]).includes(type)
    ) {
      if (!region) throw new BadRequestException('International/Global competitions require a region.');
      if (countryCode) throw new BadRequestException('International/Global competitions cannot have a countryCode.');
    }
  }

  async create(dto: CreateCompetitionDto) {
    this.validateRules(dto.type, dto.countryCode, dto.region);
    return this.prisma.competition.create({ data: dto });
  }

  async update(id: string, dto: UpdateCompetitionDto) {
    const comp = await this.findOne(id);
    const newType = dto.type !== undefined ? dto.type : comp.type;
    const newCountryCode = dto.countryCode !== undefined ? dto.countryCode : comp.countryCode;
    const newRegion = dto.region !== undefined ? dto.region : comp.region;
    
    // Validate combinations
    this.validateRules(newType, newCountryCode, newRegion);
    
    // Explicitly nullify unused fields based on type during update
    const updateData: any = { ...dto };
    if (([CompetitionType.DOMESTIC_LEAGUE, CompetitionType.DOMESTIC_CUP, CompetitionType.DOMESTIC_SUPER_CUP] as CompetitionType[]).includes(newType)) {
      updateData.region = null;
    } else {
      updateData.countryCode = null;
    }
    
    return this.prisma.competition.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.competition.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new ConflictException('Cannot delete: this competition is still referenced by other records (e.g., clubs).');
      }
      throw error;
    }
  }
}
