import { PrismaClient } from '@prisma/client';
import { PlayerDenormService } from './src/game/player-denorm.service';
import { ClubDenormService } from './src/game/club-denorm.service';

const prisma = new PrismaClient();

async function main() {
  const playerDenormService = new PlayerDenormService(prisma as any);
  const clubDenormService = new ClubDenormService(prisma as any, playerDenormService);

  const clubsWithComp = await prisma.club.findMany({
    where: { currentCompetitionId: { not: null } }
  });

  let affectedClubsCount = 0;
  let affectedPlayersSet = new Set<string>();

  for (const club of clubsWithComp) {
    const existing = await prisma.clubCompetition.findFirst({
      where: { clubId: club.id, competitionId: club.currentCompetitionId! }
    });

    if (!existing) {
      await prisma.clubCompetition.create({
        data: { clubId: club.id, competitionId: club.currentCompetitionId! }
      });
      affectedClubsCount++;
      
      const affectedPlayers = await prisma.playerClub.findMany({
        where: { clubId: club.id },
        select: { playerId: true }
      });
      for (const p of affectedPlayers) {
        affectedPlayersSet.add(p.playerId);
      }
      
      await clubDenormService.regenerateForClub(club.id);
    }
  }

  console.log(`Backfill complete.`);
  console.log(`Affected clubs count: ${affectedClubsCount}`);
  console.log(`Affected players count: ${affectedPlayersSet.size}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
