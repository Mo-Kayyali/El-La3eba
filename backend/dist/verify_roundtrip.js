"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("--- Existing Questions ---");
    const questions = await prisma.question.findMany();
    for (const q of questions) {
        console.log(`- ID: ${q.id} | Scope: ${q.scope} | Text: ${q.text}`);
    }
    console.log("\n--- Roundtrip Test ---");
    console.log("Creating new question with scope = 'BOTH'...");
    const newQ = await prisma.question.create({
        data: {
            text: "Test Question BOTH",
            gameMode: "STRIKES",
            answerType: "FILTER",
            scope: "BOTH",
            isActive: false
        }
    });
    console.log(`Created ID: ${newQ.id} with Scope: ${newQ.scope}`);
    const fetchedQ = await prisma.question.findUnique({ where: { id: newQ.id } });
    console.log(`Fetched ID: ${fetchedQ?.id} | Scope: ${fetchedQ?.scope}`);
    console.log("Cleaning up test question...");
    await prisma.question.delete({ where: { id: newQ.id } });
    console.log("Cleanup complete.");
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=verify_roundtrip.js.map