import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlayerDenormService } from './player-denorm.service';

@Injectable()
export class ClubDenormService {
  constructor(
    private prisma: PrismaService,
    private playerDenormService: PlayerDenormService,
  ) {}

  async regenerateForClub(clubId: string): Promise<string[]> {
    const clubCompetitions = await this.prisma.clubCompetition.findMany({
      where: { clubId },
      include: {
        competition: {
          select: { name: true },
        },
      },
    });

    const competitions = clubCompetitions.map((cc) => cc.competition.name);

    // Update the Club's denormalized array
    await this.prisma.club.update({
      where: { id: clubId },
      data: { competitions },
    });

    // Cascade the update to all players who have played for this club
    await this.playerDenormService.regenerateForClub(clubId);

    return competitions;
  }
}
