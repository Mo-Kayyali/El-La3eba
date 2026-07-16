import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { capitalizeWords } from '../utils/string.util';

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
  @IsArray()
  @IsUUID('all', { each: true })
  competitionIds?: string[];

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
  @IsArray()
  @IsUUID('all', { each: true })
  competitionIds?: string[];

  @IsOptional()
  @IsString()
  logoUrl?: string;
}

import { ClubDenormService } from '../game/club-denorm.service';

@Injectable()
export class AdminClubsService {
  constructor(
    private prisma: PrismaService,
    private clubDenormService: ClubDenormService,
  ) {}

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

  private async validateCompetitions(competitionIds?: string[]) {
    if (competitionIds && competitionIds.length > 0) {
      const comps = await this.prisma.competition.findMany({
        where: { id: { in: competitionIds } }
      });
      if (comps.length !== competitionIds.length) {
        throw new BadRequestException('One or more competition IDs are invalid.');
      }
    }
  }

  async findAll() {
    return this.prisma.club.findMany({
      orderBy: { name: 'asc' },
      include: { clubCompetitions: true }
    });
  }

  async findOne(id: string) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      include: {
        clubCompetitions: {
          select: { competitionId: true }
        }
      }
    });
    if (!club) throw new NotFoundException('Club not found');
    
    // Flatten clubCompetitions for the frontend
    return {
      ...club,
      competitionIds: club.clubCompetitions.map(cc => cc.competitionId)
    };
  }

  async create(dto: CreateClubDto) {
    if (dto.name) dto.name = capitalizeWords(dto.name);
    await this.validateFks(dto.countryCode, dto.currentCompetitionId);
    await this.validateCompetitions(dto.competitionIds);
    
    const { competitionIds, ...clubData } = dto;
    const club = await this.prisma.club.create({ data: clubData });
    
    if (competitionIds && competitionIds.length > 0) {
      await this.prisma.clubCompetition.createMany({
        data: competitionIds.map(compId => ({
          clubId: club.id,
          competitionId: compId
        }))
      });
      await this.clubDenormService.regenerateForClub(club.id);
    }
    
    return this.findOne(club.id);
  }

  async update(id: string, dto: UpdateClubDto) {
    if (dto.name) dto.name = capitalizeWords(dto.name);
    await this.findOne(id); // exists check
    await this.validateFks(dto.countryCode, dto.currentCompetitionId);
    await this.validateCompetitions(dto.competitionIds);
    
    const { competitionIds, ...clubData } = dto;
    
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(clubData).length > 0) {
        await tx.club.update({ where: { id }, data: clubData });
      }
      
      if (competitionIds !== undefined) {
        await tx.clubCompetition.deleteMany({ where: { clubId: id } });
        if (competitionIds.length > 0) {
          await tx.clubCompetition.createMany({
            data: competitionIds.map(compId => ({
              clubId: id,
              competitionId: compId
            }))
          });
        }
      }
    });
    
    if (competitionIds !== undefined) {
      await this.clubDenormService.regenerateForClub(id);
    }
    
    return this.findOne(id);
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
