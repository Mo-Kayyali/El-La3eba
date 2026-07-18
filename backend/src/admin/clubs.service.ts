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

  async findAll(filters: { competitionId?: string; countryCode?: string; search?: string; page?: number; limit?: number } = {}) {
    const where: any = {};
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    if (filters.competitionId) {
      where.OR = [
        { currentCompetitionId: filters.competitionId },
        { clubCompetitions: { some: { competitionId: filters.competitionId } } }
      ];
    }
    if (filters.countryCode) {
      where.countryCode = filters.countryCode;
    }

    if (filters.search) {
      const normalizedSearch = filters.search.trim();
      if (normalizedSearch.length <= 2) {
        where.name = { contains: normalizedSearch, mode: 'insensitive' };
      } else {
        const [_, matchedIdsObj] = await this.prisma.$transaction([
          this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.5;`),
          this.prisma.$queryRaw<{id: string}[]>`
            SELECT c.id
            FROM "Club" c
            WHERE 
              lower(unaccent_immutable(c.name)) %> lower(unaccent(${normalizedSearch})) OR
              lower(unaccent_immutable(array_to_string_immutable(c.aliases, ' '))) %> lower(unaccent(${normalizedSearch}))
            ORDER BY GREATEST(
              word_similarity(lower(unaccent(${normalizedSearch})), lower(unaccent_immutable(c.name))),
              word_similarity(lower(unaccent(${normalizedSearch})), lower(unaccent_immutable(array_to_string_immutable(c.aliases, ' '))))
            ) DESC
            LIMIT 500;
          `
        ]);
        const matchedIds = matchedIdsObj.map(row => row.id);
        if (matchedIds.length === 0) {
          return { data: [], meta: { total: 0, page, totalPages: 0 } };
        }
        where.id = { in: matchedIds };
      }
    }

    const total = await this.prisma.club.count({ where });
    const data = await this.prisma.club.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: { clubCompetitions: true }
    });

    return {
      data,
      meta: {
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }
    };
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
    }

    if (clubData.currentCompetitionId) {
      const exists = await this.prisma.clubCompetition.findFirst({
        where: { clubId: club.id, competitionId: clubData.currentCompetitionId }
      });
      if (!exists) {
        await this.prisma.clubCompetition.create({
          data: { clubId: club.id, competitionId: clubData.currentCompetitionId }
        });
      }
    }

    if ((competitionIds && competitionIds.length > 0) || clubData.currentCompetitionId) {
      await this.clubDenormService.regenerateForClub(club.id);
    }
    
    return this.findOne(club.id);
  }

  async update(id: string, dto: UpdateClubDto) {
    if (dto.name) dto.name = capitalizeWords(dto.name);
    const existingClub = await this.findOne(id); // exists check
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

      const finalCurrentCompId = clubData.currentCompetitionId !== undefined ? clubData.currentCompetitionId : existingClub.currentCompetitionId;
      if (finalCurrentCompId) {
        const exists = await tx.clubCompetition.findFirst({
          where: { clubId: id, competitionId: finalCurrentCompId }
        });
        if (!exists) {
          await tx.clubCompetition.create({
            data: { clubId: id, competitionId: finalCurrentCompId }
          });
        }
      }
    });
    
    if (competitionIds !== undefined || clubData.currentCompetitionId !== undefined) {
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
