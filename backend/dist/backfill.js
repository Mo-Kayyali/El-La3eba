"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const player_denorm_service_1 = require("./src/game/player-denorm.service");
const club_denorm_service_1 = require("./src/game/club-denorm.service");
const prisma = new client_1.PrismaClient();
async function main() {
    const playerDenormService = new player_denorm_service_1.PlayerDenormService(prisma);
    const clubDenormService = new club_denorm_service_1.ClubDenormService(prisma, playerDenormService);
    const clubsWithComp = await prisma.club.findMany({
        where: { currentCompetitionId: { not: null } }
    });
    let affectedClubsCount = 0;
    let affectedPlayersSet = new Set();
    for (const club of clubsWithComp) {
        const existing = await prisma.clubCompetition.findFirst({
            where: { clubId: club.id, competitionId: club.currentCompetitionId }
        });
        if (!existing) {
            await prisma.clubCompetition.create({
                data: { clubId: club.id, competitionId: club.currentCompetitionId }
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
//# sourceMappingURL=backfill.js.map