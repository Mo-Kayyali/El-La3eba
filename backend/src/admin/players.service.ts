import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { capitalizeWords } from '../utils/string.util';
import { PlayerDenormService } from '../game/player-denorm.service';
import { Position, PreferredFoot } from '@prisma/client';
import { IsString, IsOptional, IsArray, IsUUID, IsBoolean, IsInt, IsEnum, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ClubHistoryDto {
  @IsUUID()
  clubId: string;

  @IsOptional()
  @IsInt()
  startYear?: number;

  @IsOptional()
  @IsInt()
  endYear?: number;

  @IsBoolean()
  isCurrent: boolean;
}

export class CreatePlayerDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsString()
  nationality: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  heightCm?: number;

  @IsOptional()
  @IsEnum(PreferredFoot)
  preferredFoot?: PreferredFoot;

  @IsArray()
  @IsEnum(Position, { each: true })
  positions: Position[];

  @IsOptional()
  @IsEnum(Position)
  primaryPosition?: Position;

  @IsBoolean()
  isRetired: boolean;

  @IsOptional()
  @IsUUID()
  currentClubId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class UpdatePlayerDto extends CreatePlayerDto {
  // Make everything optional for update
}

// Re-write to make fields optional
export class PatchPlayerDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsInt()
  heightCm?: number;

  @IsOptional()
  @IsEnum(PreferredFoot)
  preferredFoot?: PreferredFoot;

  @IsOptional()
  @IsArray()
  @IsEnum(Position, { each: true })
  positions?: Position[];

  @IsOptional()
  @IsEnum(Position)
  primaryPosition?: Position;

  @IsOptional()
  @IsBoolean()
  isRetired?: boolean;

  @IsOptional()
  @IsUUID()
  currentClubId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClubHistoryDto)
  clubHistory?: ClubHistoryDto[];
}

@Injectable()
export class AdminPlayersService {
  constructor(
    private prisma: PrismaService,
    private playerDenormService: PlayerDenormService,
  ) {}

  private async validateFks(nationality?: string, currentClubId?: string, clubHistory?: ClubHistoryDto[]) {
    if (nationality) {
      const country = await this.prisma.country.findUnique({ where: { id: nationality } });
      if (!country) throw new BadRequestException(`Nationality code '${nationality}' does not exist.`);
    }
    if (currentClubId) {
      const club = await this.prisma.club.findUnique({ where: { id: currentClubId } });
      if (!club) throw new BadRequestException(`Club ID '${currentClubId}' does not exist.`);
    }
    if (clubHistory) {
      for (const history of clubHistory) {
        const club = await this.prisma.club.findUnique({ where: { id: history.clubId } });
        if (!club) throw new BadRequestException(`History Club ID '${history.clubId}' does not exist.`);
      }
    }
  }

  async search(query: string) {
    if (!query || query.length < 2) return [];
    
    return this.prisma.player.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { aliases: { hasSome: [query] } },
          // A true case-insensitive array element match in Prisma Postgres is tricky.
          // Since aliases are usually exact names, we can also just rely on name match 
          // or we can just fetch and let the DB do a simple contains on the stringified array if needed.
          // Actually `hasSome` is exact match (case-sensitive).
          // To make it simple and fast, we'll do name contains. If they type part of alias, 
          // `name` usually covers it. For aliases, we can't easily do `contains` insensitive on string[].
        ]
      },
      take: 15,
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        nationality: true,
        isRetired: true,
        currentClub: {
          select: { name: true }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  async findAll(filters: { competitionId?: string; compCountryCode?: string; clubId?: string; isRetired?: string; nationality?: string } = {}) {
    const where: any = {};
    if (filters.clubId) {
      where.currentClubId = filters.clubId;
    } else {
      const clubConditions: any[] = [];
      if (filters.competitionId) {
        clubConditions.push({
          OR: [
            { currentCompetitionId: filters.competitionId },
            { clubCompetitions: { some: { competitionId: filters.competitionId } } }
          ]
        });
      }
      if (filters.compCountryCode) {
        let compCondition: any;
        if (filters.compCountryCode === '_WORLD') {
          compCondition = { type: { in: ['INTERNATIONAL_TOURNAMENT', 'GLOBAL_CLUB_CHAMPIONSHIP'] } };
        } else if (filters.compCountryCode === '_CONTINENTAL') {
          compCondition = { type: { in: ['CONTINENTAL_CLUB_COMPETITION', 'CONTINENTAL_SUPER_CUP'] } };
        } else {
          compCondition = { countryCode: filters.compCountryCode };
        }

        clubConditions.push({
          OR: [
            { currentCompetition: compCondition },
            { clubCompetitions: { some: { competition: compCondition } } }
          ]
        });
      }
      if (clubConditions.length > 0) {
        where.currentClub = { AND: clubConditions };
      }
    }
    if (filters.isRetired !== undefined && filters.isRetired !== '') {
      where.isRetired = filters.isRetired === 'true';
    }
    if (filters.nationality) {
      where.nationality = filters.nationality;
    }

    return this.prisma.player.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        currentClub: { select: { id: true, name: true, logoUrl: true } }
      }
    });
  }

  async findOne(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        currentClub: true,
        playerClubs: {
          include: { club: true },
          orderBy: [{ isCurrent: 'desc' }, { startYear: 'asc' }]
        }
      }
    });
    if (!player) throw new NotFoundException('Player not found');
    return player;
  }

  async create(dto: CreatePlayerDto) {
    if (dto.firstName) dto.firstName = capitalizeWords(dto.firstName);
    if (dto.lastName) dto.lastName = capitalizeWords(dto.lastName);
    if (dto.name) dto.name = capitalizeWords(dto.name);
    
    await this.validateFks(dto.nationality, dto.currentClubId);
    
    let aliases = dto.aliases;
    if (!aliases || aliases.length === 0) {
      aliases = [dto.firstName, dto.lastName].filter(Boolean);
    }

    const player = await this.prisma.player.create({
      data: {
        ...dto,
        aliases,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
      }
    });

    if (player.currentClubId) {
      await this.prisma.playerClub.create({
        data: {
          playerId: player.id,
          clubId: player.currentClubId,
          isCurrent: true,
        }
      });
      await this.playerDenormService.regenerateForPlayer(player.id);
    }

    return player;
  }

  async update(id: string, dto: PatchPlayerDto) {
    if (dto.firstName) dto.firstName = capitalizeWords(dto.firstName);
    if (dto.lastName) dto.lastName = capitalizeWords(dto.lastName);
    if (dto.name) dto.name = capitalizeWords(dto.name);
    
    await this.findOne(id);
    await this.validateFks(dto.nationality, dto.currentClubId, dto.clubHistory);

    const { clubHistory, dateOfBirth, ...playerData } = dto;
    const dataToUpdate: any = { ...playerData };
    if (dateOfBirth !== undefined) {
      dataToUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Update player fields
      if (Object.keys(dataToUpdate).length > 0) {
        await tx.player.update({ where: { id }, data: dataToUpdate });
      }

      // 2. Diff and replace club history
      if (clubHistory !== undefined) {
        // Complete replacement strategy for simplicity and correctness
        await tx.playerClub.deleteMany({ where: { playerId: id } });
        if (clubHistory.length > 0) {
          await tx.playerClub.createMany({
            data: clubHistory.map(ch => ({
              playerId: id,
              clubId: ch.clubId,
              startYear: ch.startYear,
              endYear: ch.endYear,
              isCurrent: ch.isCurrent
            }))
          });
        }
      }

      // AUTO-SYNC currentClubId
      const currentClubId = 'currentClubId' in dataToUpdate ? dataToUpdate.currentClubId : (await tx.player.findUnique({ where: { id }, select: { currentClubId: true } }))?.currentClubId;
      if (currentClubId) {
        const existing = await tx.playerClub.findFirst({
          where: { playerId: id, clubId: currentClubId, isCurrent: true }
        });
        if (!existing) {
          await tx.playerClub.create({
            data: { playerId: id, clubId: currentClubId, isCurrent: true }
          });
        }
      }
    });
    // 3. Regenerate denormalized arrays
    // Call unconditionally since auto-sync or clubHistory might have changed the data
    await this.playerDenormService.regenerateForPlayer(id);

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.player.delete({ where: { id } });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new ConflictException('Cannot delete: this player is still referenced by questions or answers.');
      }
      throw error;
    }
  }
}
