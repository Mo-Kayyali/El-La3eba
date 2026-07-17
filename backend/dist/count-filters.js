"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const count = await prisma.question.count({
        where: { answerType: 'FILTER' }
    });
    console.log('FILTER question count:', count);
}
main().finally(() => process.exit(0));
//# sourceMappingURL=count-filters.js.map