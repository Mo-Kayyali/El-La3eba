"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const clubClauses = await prisma.questionFilterClause.findMany({ where: { filterType: 'CLUB' } });
    console.log("Club clauses:", JSON.stringify(clubClauses, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=query_club_filter.js.map