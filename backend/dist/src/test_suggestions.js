"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('--- STARTING SUGGESTIONS E2E VERIFICATION ---');
    const user = await prisma.user.findFirst();
    if (!user)
        throw new Error("No user found");
    const player = await prisma.player.findFirst();
    if (!player)
        throw new Error("No player found");
    const listQuestion = await prisma.question.findFirst({
        where: { answerType: 'LIST' }
    });
    if (!listQuestion)
        throw new Error("No list question found");
    console.log(`Using User: ${user.username}, Player: ${player.name}, Question: ${listQuestion.text}`);
    console.log('\n--> Creating Suggestion...');
    const suggestion = await prisma.answerSuggestion.create({
        data: {
            questionId: listQuestion.id,
            playerId: player.id,
            guessText: 'Test Guess',
            suggestedBy: user.id,
            comment: 'This should be correct!',
            status: 'PENDING',
        }
    });
    console.log('Suggestion created:', suggestion.id);
    console.log('\n--> Admin Approving...');
    const fromDb = await prisma.answerSuggestion.findUnique({ where: { id: suggestion.id }, include: { question: true } });
    if (!fromDb)
        throw new Error("Suggestion not found");
    let createdAnswer = false;
    if (fromDb.question.answerType === 'LIST') {
        const existing = await prisma.questionAnswer.findUnique({
            where: {
                questionId_playerId: { questionId: fromDb.questionId, playerId: fromDb.playerId }
            }
        });
        if (!existing) {
            await prisma.questionAnswer.create({
                data: { questionId: fromDb.questionId, playerId: fromDb.playerId }
            });
            createdAnswer = true;
        }
    }
    const updated = await prisma.answerSuggestion.update({
        where: { id: suggestion.id },
        data: { status: 'APPROVED', reviewNote: 'Looks good', reviewedAt: new Date() }
    });
    console.log('Suggestion updated:', updated.status);
    console.log('Created Answer in DB:', createdAnswer);
    console.log('\n--> Cleaning up...');
    await prisma.answerSuggestion.delete({ where: { id: suggestion.id } });
    if (createdAnswer) {
        await prisma.questionAnswer.delete({
            where: {
                questionId_playerId: { questionId: fromDb.questionId, playerId: fromDb.playerId }
            }
        });
    }
    console.log('--- TEST COMPLETE ---');
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=test_suggestions.js.map