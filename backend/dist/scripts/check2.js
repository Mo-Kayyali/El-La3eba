"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const c = await prisma.country.findMany({ where: { name: { in: ['Germany', 'Portugal', 'Paraguay', 'Algeria', 'Guatemala', 'Benin'] } } });
    console.log(c);
}
main().finally(() => process.exit(0));
//# sourceMappingURL=check2.js.map