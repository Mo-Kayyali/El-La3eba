"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const count = await prisma.question.count();
    console.log(`Total questions: ${count}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=count_questions.js.map