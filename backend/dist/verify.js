"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const position_util_1 = require("./src/game/position.util");
const prisma = new client_1.PrismaClient();
async function main() {
    const pedri = await prisma.player.findFirst({ where: { name: 'Pedri' } });
    const jude = await prisma.player.findFirst({ where: { name: 'Jude Bellingham' } });
    console.log("Pedri competitions:", pedri?.competitions);
    console.log("Jude competitions:", jude?.competitions);
    const evaluatePosition = (player, filterValue) => {
        const allowedPositions = filterValue ? position_util_1.POSITION_CATEGORY_MAP[filterValue] || [] : [];
        return player.positions?.some((p) => allowedPositions.includes(p)) ?? false;
    };
    const evaluateCompetition = (player, filterValue) => {
        return player.competitions?.includes(filterValue) ?? false;
    };
    console.log("Pedri POSITION_CATEGORY MIDFIELDER:", evaluatePosition(pedri, "MIDFIELDER"));
    console.log("Jude POSITION_CATEGORY MIDFIELDER:", evaluatePosition(jude, "MIDFIELDER"));
    console.log("Pedri COMPETITION LaLiga:", evaluateCompetition(pedri, "LaLiga"));
    console.log("Jude COMPETITION LaLiga:", evaluateCompetition(jude, "LaLiga"));
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=verify.js.map