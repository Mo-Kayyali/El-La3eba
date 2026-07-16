import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CompetitionType } from '@prisma/client';

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

  async create(dto: CreateCompetitionDto) {
    return this.prisma.competition.create({ data: dto });
  }

  async update(id: string, dto: UpdateCompetitionDto) {
    await this.findOne(id);
    return this.prisma.competition.update({ where: { id }, data: dto });
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
