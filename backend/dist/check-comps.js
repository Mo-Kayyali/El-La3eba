"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const count = await prisma.$queryRawUnsafe(`SELECT * FROM "Competition" WHERE "type"::text IN ('CONTINENTAL_CLUB', 'INTERNATIONAL_NATIONAL_TEAM')`);
    console.log('Competitions with old types:', count.length);
    const allComps = await prisma.competition.findMany();
    console.log('Total competitions:', allComps.length);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-comps.js.map