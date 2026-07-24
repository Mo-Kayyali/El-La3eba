"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const game_service_1 = require("./src/game/game.service");
const prisma = new client_1.PrismaClient();
const gameService = new game_service_1.GameService(prisma);
async function check(input, expected) {
    const candidates = await gameService.guessPlayer(input);
    const c0 = candidates[0];
    const c1 = candidates[1];
    const isAmbiguous = c0?.isAmbiguous ?? false;
    const topConf = c0?.matchConfidence ?? 0;
    const nearTopCount = candidates.filter((c) => Math.abs(c.matchConfidence - topConf) <= 0.001 && c.bestReason === 'exact').length;
    return {
        input,
        expected,
        topCandidate: c0 ? `${c0.name}` : 'NONE',
        cand0Conf: c0 ? (c0.matchConfidence * 100).toFixed(1) + '%' : 'N/A',
        cand1: c1 ? `${c1.name}` : 'N/A',
        cand1Conf: c1 ? (c1.matchConfidence * 100).toFixed(1) + '%' : 'N/A',
        nearTopGroup: nearTopCount,
        isAmbiguous: isAmbiguous ? 'YES' : 'NO',
        resolution: isAmbiguous ? 'AMBIGUOUS (STRIKE)' : c0 ? `RESOLVED: ${c0.name}` : 'NO MATCH',
    };
}
async function main() {
    console.log('\n=== FULL 24-CASE MATRIX + GENERIC NAMES + MBAPPE REGRESSION ===\n');
    const cases = [
        ['messi', 'Lionel Messi'],
        ['mbappe', 'Kylian Mbappe'],
        ['salah', 'Mohamed Salah → now AMBIGUOUS (9-way tie)'],
        ['ronaldo', 'Ronaldo / CR7'],
        ['beckham', 'David Beckham'],
        ['haaland', 'Erling Haaland'],
        ['kane', 'Harry Kane'],
        ['benzema', 'Karim Benzema'],
        ['neymar', 'Neymar'],
        ['pedri', 'Pedri'],
        ['gavi', 'Gavi'],
        ['modric', 'Luka Modric'],
        ['ahmed', 'AMBIGUOUS (24-way)'],
        ['mohamed', 'AMBIGUOUS (25-way)'],
        ['mahmoud', 'AMBIGUOUS (29-way)'],
        ['ali', 'AMBIGUOUS (24-way)'],
        ['omar', 'AMBIGUOUS (17-way)'],
        ['sobhi ramadan', 'Ramadan Sobhi'],
        ['bekham', 'David Beckham (typo)'],
        ['benromdhane', 'Mohamed Ali Ben Romdhane'],
        ['ben ramadan', 'Ramadan Sobhi / Beckham'],
        ['lionel messi', 'Lionel Messi'],
        ['kylian mbappe', 'Kylian Mbappe'],
        ['david beckham', 'David Beckham'],
        ['cristiano ronaldo', 'Cristiano Ronaldo'],
        ['mohamed salah', 'Mohamed Salah'],
    ];
    const results = await Promise.all(cases.map(([input, expected]) => check(input, expected)));
    console.table(results);
}
main()
    .catch((e) => console.error(e))
    .finally(async () => { await prisma.$disconnect(); });
//# sourceMappingURL=test-nway-integrated.js.map