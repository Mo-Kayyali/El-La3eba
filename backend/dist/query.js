"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const pedri = await prisma.player.findMany({ where: { name: { contains: 'Pedri', mode: 'insensitive' } } });
    const jude = await prisma.player.findMany({ where: { name: { contains: 'Jude Bellingham', mode: 'insensitive' } } });
    console.log("Pedri:");
    pedri.forEach(p => console.log(JSON.stringify({
        name: p.name,
        positions: p.positions,
        primaryPosition: p.primaryPosition,
        clubs: p.clubs,
        competitions: p.competitions,
    }, null, 2)));
    console.log("Jude Bellingham:");
    jude.forEach(p => console.log(JSON.stringify({
        name: p.name,
        positions: p.positions,
        primaryPosition: p.primaryPosition,
        clubs: p.clubs,
        competitions: p.competitions,
    }, null, 2)));
    const posClauses = await prisma.questionFilterClause.findMany({ where: { filterType: 'POSITION_CATEGORY' } });
    const compClauses = await prisma.questionFilterClause.findMany({ where: { filterType: 'COMPETITION' } });
    console.log("Position clauses:", JSON.stringify(posClauses, null, 2));
    console.log("Competition clauses:", JSON.stringify(compClauses, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=query.js.map