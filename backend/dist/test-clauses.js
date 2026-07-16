"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const game_service_1 = require("./src/game/game.service");
const prisma = new client_1.PrismaClient();
async function main() {
    const gameService = new game_service_1.GameService(prisma);
    const q1 = await prisma.question.create({
        data: {
            text: 'Played for Real Madrid or Barcelona',
            gameMode: client_1.GameMode.STRIKES,
            answerType: client_1.AnswerType.FILTER,
            logicOperator: client_1.LogicOperator.OR,
            clauses: {
                create: [
                    { filterType: client_1.FilterType.CLUB, filterValue: 'Real Madrid ID' },
                    { filterType: client_1.FilterType.CLUB, filterValue: 'Barcelona ID' },
                ],
            },
        },
        include: { clauses: true },
    });
    const q2 = await prisma.question.create({
        data: {
            text: 'Spanish player who played for Real Madrid',
            gameMode: client_1.GameMode.STRIKES,
            answerType: client_1.AnswerType.FILTER,
            logicOperator: client_1.LogicOperator.AND,
            clauses: {
                create: [
                    { filterType: client_1.FilterType.NATIONALITY, filterValue: 'ESP' },
                    { filterType: client_1.FilterType.CLUB, filterValue: 'Real Madrid ID' },
                ],
            },
        },
        include: { clauses: true },
    });
    console.log('Created questions successfully.');
    const pRealMadrid = {
        clubs: ['Real Madrid ID'],
        nationality: 'BRA',
    };
    const pBarcelona = {
        clubs: ['Barcelona ID'],
        nationality: 'ARG',
    };
    const pSpanishRealMadrid = {
        clubs: ['Real Madrid ID'],
        nationality: 'ESP',
    };
    const pSpanishOther = {
        clubs: ['Sevilla ID'],
        nationality: 'ESP',
    };
    console.log('--- Testing OR Question (Real Madrid OR Barcelona) ---');
    console.log('Real Madrid player accepted?', await gameService.validateAnswer(q1, pRealMadrid));
    console.log('Barcelona player accepted?', await gameService.validateAnswer(q1, pBarcelona));
    console.log('SpanishOther player accepted?', await gameService.validateAnswer(q1, pSpanishOther));
    console.log('\n--- Testing AND Question (Real Madrid AND Spanish) ---');
    console.log('Spanish player + Real Madrid accepted?', await gameService.validateAnswer(q2, pSpanishRealMadrid));
    console.log('Brazilian player + Real Madrid accepted? (Only one condition)', await gameService.validateAnswer(q2, pRealMadrid));
    console.log('Spanish player + Sevilla accepted? (Only one condition)', await gameService.validateAnswer(q2, pSpanishOther));
    await prisma.question.delete({ where: { id: q1.id } });
    await prisma.question.delete({ where: { id: q2.id } });
}
main().catch(console.error).finally(() => process.exit(0));
//# sourceMappingURL=test-clauses.js.map