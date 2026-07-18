"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function testMatch() {
    const tests = [
        { stored: 'Mahmoud Trezeguet', guess: 'mahmoud hassan trezeguet' },
        { stored: 'Hussein El Shahat', guess: 'hussien elshahat' },
        { stored: 'Hussein El Shahat', guess: 'hussien alshahat' },
        { stored: 'Wessam Abou Ali', guess: 'wessam abou' },
        { stored: 'Wessam Abou Ali', guess: 'wessam aboali' },
        { stored: 'Wessam Abou Ali', guess: 'wessam ali' },
        { stored: 'Achraf Bencharki', guess: 'ashraf ben' },
        { stored: 'Ahmed Abdelkader', guess: 'ahmed abd kadr' },
    ];
    for (const t of tests) {
        const res = await prisma.$queryRaw `
      SELECT 
        word_similarity(${t.guess}, lower(unaccent(${t.stored}))) as ws1,
        word_similarity(lower(unaccent(${t.stored})), ${t.guess}) as ws2,
        strict_word_similarity(${t.guess}, lower(unaccent(${t.stored}))) as sws1,
        strict_word_similarity(lower(unaccent(${t.stored})), ${t.guess}) as sws2,
        similarity(replace(${t.guess}, ' ', ''), replace(lower(unaccent(${t.stored})), ' ', '')) as sim_nospace,
        levenshtein(replace(${t.guess}, ' ', ''), replace(lower(unaccent(${t.stored})), ' ', '')) as lev_nospace
    `;
        console.log(`Stored: ${t.stored} | Guess: ${t.guess}`);
        console.log(res[0]);
    }
}
testMatch()
    .then(() => process.exit(0))
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=test-match.js.map