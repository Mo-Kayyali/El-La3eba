"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const game_service_1 = require("./src/game/game.service");
const prisma = new client_1.PrismaClient();
const gameService = new game_service_1.GameService(prisma);
async function main() {
    await prisma.question.deleteMany();
    await prisma.question.createMany({
        data: [
            { id: 'q1', text: 'Question A', gameMode: 'STRIKES', answerType: 'LIST' },
            { id: 'q2', text: 'Question B', gameMode: 'STRIKES', answerType: 'LIST' },
            { id: 'q3', text: 'Question C', gameMode: 'STRIKES', answerType: 'LIST' },
        ]
    });
    const usedIds = [];
    const sequence = [];
    for (let i = 0; i < 10; i++) {
        const q = await gameService.getRandomQuestion('STRIKES', usedIds);
        if (!q) {
            console.log('Got NULL question!');
            break;
        }
        sequence.push(q.id);
        usedIds.push(q.id);
    }
    console.log('10 rounds with 3 questions pool:');
    console.log(sequence.join(' -> '));
    let hasRepeat = false;
    for (let i = 1; i < sequence.length; i++) {
        if (sequence[i] === sequence[i - 1]) {
            hasRepeat = true;
            console.error('FAILED: Back-to-back repeat found at', i, ':', sequence[i]);
        }
    }
    if (!hasRepeat)
        console.log('SUCCESS: No immediate back-to-back repeats.');
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=test-exhaust.js.map