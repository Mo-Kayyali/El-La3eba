"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const pedri = await prisma.player.findFirst({ where: { name: 'Pedri' } });
    const barca = await prisma.club.findFirst({ where: { name: 'Barcelona' }, include: { currentCompetition: true } });
    const laliga = await prisma.competition.findFirst({ where: { name: 'LaLiga' } });
    const clubComps = await prisma.clubCompetition.findMany();
    console.log("Pedri's currentClubId:", pedri?.currentClubId);
    console.log("Barca ID:", barca?.id);
    console.log("Barca current competition:", barca?.currentCompetition?.id, barca?.currentCompetition?.name);
    console.log("Barca competitions denormalized:", barca?.competitions);
    console.log("LaLiga ID:", laliga?.id);
    console.log("All ClubCompetitions:", JSON.stringify(clubComps, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=query_comp.js.map