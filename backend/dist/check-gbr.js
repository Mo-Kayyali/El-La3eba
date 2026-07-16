"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const clubs = await prisma.club.count({ where: { countryCode: 'GBR' } });
    const players = await prisma.player.count({ where: { nationality: 'GBR' } });
    console.log('Clubs with GBR:', clubs);
    console.log('Players with GBR:', players);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-gbr.js.map