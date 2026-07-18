"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function run() {
    try {
        const user = await prisma.user.findFirst();
        const question = await prisma.question.findFirst();
        if (!user || !question) {
            console.log('No user or question found to test with.');
            return;
        }
        const suggestion = await prisma.answerSuggestion.create({
            data: {
                questionId: question.id,
                playerId: null,
                guessText: 'Testing Unmatched Guess',
                suggestedBy: user.id,
                status: 'PENDING',
            }
        });
        console.log('Successfully created suggestion with null playerId:', suggestion.id);
        const fetched = await prisma.answerSuggestion.findUnique({
            where: { id: suggestion.id }
        });
        console.log('Fetched suggestion playerId:', fetched?.playerId);
        await prisma.answerSuggestion.delete({ where: { id: suggestion.id } });
        console.log('Cleanup successful.');
    }
    catch (err) {
        console.error('Error during test:', err);
    }
    finally {
        await prisma.$disconnect();
    }
}
run();
//# sourceMappingURL=test-suggestion-null.js.map