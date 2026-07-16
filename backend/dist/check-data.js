"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- QuestionFilterClause with CLUB ---');
    const clauses = await prisma.questionFilterClause.findMany({
        where: { filterType: 'CLUB' },
    });
    console.log(clauses);
    console.log('\n--- Player sample (Real Madrid test case) ---');
    const club = await prisma.club.findFirst({
        where: { name: { contains: 'Real Madrid', mode: 'insensitive' } }
    });
    if (club) {
        console.log('Found club:', club);
        const playerClub = await prisma.playerClub.findFirst({
            where: { clubId: club.id },
            include: { player: true }
        });
        if (playerClub) {
            console.log('Found auto-sync PlayerClub row for test player:', playerClub.playerId, 'isCurrent:', playerClub.isCurrent);
            const player = await prisma.player.findUnique({
                where: { id: playerClub.playerId }
            });
            console.log('Player.clubs:', player?.clubs);
        }
        else {
            console.log('No player found for Real Madrid');
        }
    }
    else {
        console.log('Real Madrid club not found');
    }
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=check-data.js.map