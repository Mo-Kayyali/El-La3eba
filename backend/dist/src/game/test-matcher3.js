"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const guess_matcher_util_1 = require("./guess-matcher.util");
const tests = [
    { stored: 'Mahmoud Trezeguet', guess: 'mahmoud hassan trezeguet' },
    { stored: 'Hussein El Shahat', guess: 'hussien elshahat' },
    { stored: 'Hussein El Shahat', guess: 'hussien alshahat' },
    { stored: 'Wessam Abou Ali', guess: 'wessam abou' },
    { stored: 'Wessam Abou Ali', guess: 'wessam aboali' },
    { stored: 'Wessam Ali', guess: 'wessam ali' },
    { stored: 'Wessam Abou Ali', guess: 'wessam ali' },
    { stored: 'Achraf Bencharki', guess: 'ashraf ben' },
    { stored: 'Ahmed Abdelkader', guess: 'ahmed abd kadr' },
    { stored: 'Mohamed Salah', guess: 'mo salah' },
    { stored: 'Lionel Messi', guess: 'messi' },
    { stored: 'Cristiano Ronaldo', guess: 'cronaldo' },
];
for (const t of tests) {
    const result = (0, guess_matcher_util_1.evaluateMatch)(t.guess, t.stored);
    console.log(`[${result.confidence.toFixed(2)}] ${t.guess} -> ${t.stored}`);
}
//# sourceMappingURL=test-matcher3.js.map