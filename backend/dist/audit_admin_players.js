"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient({ log: ['query'] });
async function main() {
    const res = await prisma.$queryRawUnsafe(`
    EXPLAIN ANALYZE
    SELECT p.*, c.name as "currentClubName"
    FROM "Player" p
    LEFT JOIN "Club" c ON p."currentClubId" = c.id
    ORDER BY p.name ASC;
  `);
    console.log(JSON.stringify(res, null, 2));
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=audit_admin_players.js.map