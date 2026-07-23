"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const questions_service_1 = require("./src/admin/questions.service");
const prisma_service_1 = require("./src/prisma/prisma.service");
const client_1 = require("@prisma/client");
const common_1 = require("@nestjs/common");
async function runVerification() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const questionsService = app.get(questions_service_1.AdminQuestionsService);
    const prisma = app.get(prisma_service_1.PrismaService);
    const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const adminId = adminUser ? adminUser.id : '00000000-0000-0000-0000-000000000000';
    const players = await prisma.player.findMany({ take: 14 });
    if (players.length < 14) {
        console.error('❌ Need at least 14 players in DB to run test.');
        await app.close();
        process.exit(1);
    }
    console.log('=== VERIFICATION SCRIPT: TOP_10 Server Validation ===\n');
    try {
        const answers = players.slice(0, 5).map((p, idx) => ({ playerId: p.id, rank: idx + 1 }));
        await questionsService.create({
            text: 'Test Top 10 Invalid 5 Answers',
            gameMode: client_1.GameMode.TOP_10,
            scope: client_1.QuestionScope.BOTH,
            answerType: client_1.AnswerType.LIST,
            answers,
        }, adminId);
        console.log('❌ Test 1 Failed: Fewer than 13 answers was saved!');
    }
    catch (err) {
        if (err instanceof common_1.BadRequestException && err.message.includes('must have exactly 13 answers')) {
            console.log('✅ Test 1 Passed: Fewer than 13 answers rejected with message:', err.message);
        }
        else {
            console.log('❌ Test 1 Failed with unexpected error:', err.message);
        }
    }
    try {
        const answers = players.slice(0, 14).map((p, idx) => ({ playerId: p.id, rank: idx + 1 }));
        await questionsService.create({
            text: 'Test Top 10 Invalid 14 Answers',
            gameMode: client_1.GameMode.TOP_10,
            scope: client_1.QuestionScope.BOTH,
            answerType: client_1.AnswerType.LIST,
            answers,
        }, adminId);
        console.log('❌ Test 2 Failed: More than 13 answers was saved!');
    }
    catch (err) {
        if (err instanceof common_1.BadRequestException && err.message.includes('must have exactly 13 answers')) {
            console.log('✅ Test 2 Passed: More than 13 answers rejected with message:', err.message);
        }
        else {
            console.log('❌ Test 2 Failed with unexpected error:', err.message);
        }
    }
    try {
        const answers = players.slice(0, 13).map((p, idx) => ({
            playerId: p.id,
            rank: idx === 1 ? 5 : idx + 1,
        }));
        await questionsService.create({
            text: 'Test Top 10 Duplicate Ranks',
            gameMode: client_1.GameMode.TOP_10,
            scope: client_1.QuestionScope.BOTH,
            answerType: client_1.AnswerType.LIST,
            answers,
        }, adminId);
        console.log('❌ Test 3 Failed: Duplicate rank was saved!');
    }
    catch (err) {
        if (err instanceof common_1.BadRequestException && err.message.includes('Duplicate rank')) {
            console.log('✅ Test 3 Passed: Duplicate rank rejected with message:', err.message);
        }
        else {
            console.log('❌ Test 3 Failed with unexpected error:', err.message);
        }
    }
    try {
        const answers = players.slice(0, 13).map((p, idx) => ({
            playerId: p.id,
            rank: idx === 0 ? undefined : idx + 1,
        }));
        await questionsService.create({
            text: 'Test Top 10 Missing Rank',
            gameMode: client_1.GameMode.TOP_10,
            scope: client_1.QuestionScope.BOTH,
            answerType: client_1.AnswerType.LIST,
            answers,
        }, adminId);
        console.log('❌ Test 4 Failed: Unranked answer was saved!');
    }
    catch (err) {
        if (err instanceof common_1.BadRequestException && (err.message.includes('rank') || err.message.includes('integer'))) {
            console.log('✅ Test 4 Passed: Unranked answer rejected with message:', err.message);
        }
        else {
            console.log('❌ Test 4 Failed with unexpected error:', err.message);
        }
    }
    let createdTop10Id = null;
    try {
        const answers = players.slice(0, 13).map((p, idx) => ({
            playerId: p.id,
            rank: idx + 1,
        }));
        const created = await questionsService.create({
            text: 'Test Top 10 Valid Question',
            gameMode: client_1.GameMode.TOP_10,
            scope: client_1.QuestionScope.BOTH,
            answerType: client_1.AnswerType.LIST,
            answers,
        }, adminId);
        createdTop10Id = created.id;
        console.log('✅ Test 5 Passed: Valid 13-answer TOP_10 question saved successfully! ID:', created.id);
    }
    catch (err) {
        console.log('❌ Test 5 Failed to save valid TOP_10 question:', err.message);
    }
    finally {
        if (createdTop10Id) {
            await prisma.question.delete({ where: { id: createdTop10Id } });
        }
    }
    let createdStrikesId = null;
    try {
        const answers = [{ playerId: players[0].id }];
        const created = await questionsService.create({
            text: 'Test Strikes Single Answer Question',
            gameMode: client_1.GameMode.STRIKES,
            scope: client_1.QuestionScope.BOTH,
            answerType: client_1.AnswerType.LIST,
            answers,
        }, adminId);
        createdStrikesId = created.id;
        console.log('✅ Test 6 Passed: STRIKES question saved without TOP_10 constraints! ID:', created.id);
    }
    catch (err) {
        console.log('❌ Test 6 Failed for STRIKES regression check:', err.message);
    }
    finally {
        if (createdStrikesId) {
            await prisma.question.delete({ where: { id: createdStrikesId } });
        }
    }
    await app.close();
}
runVerification().catch(console.error);
//# sourceMappingURL=verify-top10-validation.js.map