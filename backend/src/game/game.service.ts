import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async guessPlayer(guessName: string) {
    const matches = await this.prisma.$queryRaw<any[]>`
      SELECT *, similarity(name, ${guessName}) as sim
      FROM "FootballPlayer"
      WHERE similarity(name, ${guessName}) > 0.4
      ORDER BY sim DESC
      LIMIT 1;
    `;

    return matches.length > 0 ? matches[0] : null;
  }
}
