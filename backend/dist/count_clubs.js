"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const totalClubs = await prisma.club.count();
    const clubsWithCompId = await prisma.club.count({ where: { currentCompetitionId: { not: null } } });
    console.log(`Total Club rows in database: ${totalClubs}`);
    console.log(`Clubs with currentCompetitionId set: ${clubsWithCompId}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=count_clubs.js.map