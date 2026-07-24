"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const guess_matcher_util_1 = require("./src/game/guess-matcher.util");
function matchTokenProposed(gToken, tToken) {
    if (gToken === tToken)
        return { matches: true, penalty: 0, reason: 'exact' };
    if (tToken.startsWith(gToken) || gToken.startsWith(tToken)) {
        const minLength = Math.min(gToken.length, tToken.length);
        if (minLength >= 3) {
            const lenDiff = Math.abs(gToken.length - tToken.length);
            const prefixPenalty = 0.5 + Math.min(0.4, lenDiff * 0.1);
            return { matches: true, penalty: prefixPenalty, reason: 'prefix' };
        }
    }
    const dist = (0, guess_matcher_util_1.levenshtein)(gToken, tToken);
    const maxTypos = Math.max(1, Math.floor(Math.max(gToken.length, tToken.length) / 3));
    if (dist <= maxTypos) {
        return { matches: true, penalty: dist * 0.8, reason: 'typo' };
    }
    if (tToken.includes(gToken) && gToken.length >= 4) {
        return { matches: true, penalty: 1.0, reason: 'substring' };
    }
    return { matches: false, penalty: Infinity, reason: 'none' };
}
function evaluateMatchProposed(guess, target) {
    const g = guess.toLowerCase().replace(/-/g, ' ');
    const t = target.toLowerCase().replace(/-/g, ' ');
    const gTokens = g.split(' ').filter(Boolean);
    const tTokens = t.split(' ').filter(Boolean);
    let matches = [];
    for (let i = 0; i < gTokens.length; i++) {
        for (let j = 0; j < tTokens.length; j++) {
            for (let gLen = 1; i + gLen <= gTokens.length; gLen++) {
                const gStr = gTokens.slice(i, i + gLen).join('');
                for (let tLen = 1; j + tLen <= tTokens.length; tLen++) {
                    const tStr = tTokens.slice(j, j + tLen).join('');
                    const matchResult = matchTokenProposed(gStr, tStr);
                    if (matchResult.matches) {
                        matches.push({
                            gStart: i,
                            gEnd: i + gLen - 1,
                            tStart: j,
                            tEnd: j + tLen - 1,
                            gStr,
                            tStr,
                            penalty: matchResult.penalty,
                            reason: matchResult.reason,
                        });
                    }
                }
            }
        }
    }
    console.log(`Evaluating "${guess}" vs "${target}":`);
    console.log('Matches:', matches);
    if (matches.length === 0)
        return { score: Infinity, penalty: Infinity, confidence: 0 };
    matches.sort((a, b) => {
        if (a.penalty !== b.penalty)
            return a.penalty - b.penalty;
        const lenA = a.gEnd - a.gStart + a.tEnd - a.tStart;
        const lenB = b.gEnd - b.gStart + b.tEnd - b.tStart;
        return lenB - lenA;
    });
    const finalMatches = [matches[0]];
    const matchedGChars = finalMatches.reduce((sum, m) => sum + m.gStr.length, 0);
    const totalGChars = gTokens.join('').length;
    const matchedTTokensCount = new Set(finalMatches.map((m) => m.tStart)).size;
    const totalTTokensCount = tTokens.length;
    const unmatchedTTokensCount = totalTTokensCount - matchedTTokensCount;
    const totalMatchPenalty = finalMatches.reduce((sum, m) => sum + m.penalty, 0);
    const unmatchedGCharsPenalty = (totalGChars - matchedGChars) * 0.4;
    const unmatchedTTokensPenalty = unmatchedTTokensCount * 0.05;
    const totalScore = totalMatchPenalty + unmatchedGCharsPenalty + unmatchedTTokensPenalty;
    const confidence = Math.max(0, 1 - totalScore / (gTokens.length + 0.5));
    console.log(`Score: ${totalScore}, Confidence: ${confidence.toFixed(3)}`);
    return { score: totalScore, confidence };
}
evaluateMatchProposed('bekham', 'David Beckham');
//# sourceMappingURL=test-tiebreaker-and-typo.js.map