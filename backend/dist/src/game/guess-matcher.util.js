"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.levenshtein = levenshtein;
exports.getTokenCombinations = getTokenCombinations;
exports.matchToken = matchToken;
exports.evaluateMatch = evaluateMatch;
function levenshtein(a, b) {
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i++)
        matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++)
        matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
        }
    }
    return matrix[b.length][a.length];
}
function getTokenCombinations(tokens) {
    const combinations = [];
    for (let i = 0; i < tokens.length; i++) {
        let current = "";
        for (let j = i; j < tokens.length; j++) {
            current += tokens[j];
            combinations.push(current);
        }
    }
    return [...new Set(combinations)];
}
function matchToken(gToken, tToken) {
    if (gToken === tToken)
        return { matches: true, penalty: 0.0, reason: "exact" };
    if (tToken.startsWith(gToken) || gToken.startsWith(tToken)) {
        const minLength = Math.min(gToken.length, tToken.length);
        if (minLength >= 3) {
            const lenDiff = Math.abs(gToken.length - tToken.length);
            const prefixPenalty = 0.3 + Math.min(0.3, lenDiff * 0.05);
            return { matches: true, penalty: prefixPenalty, reason: "prefix" };
        }
    }
    const dist = levenshtein(gToken, tToken);
    const maxTypos = Math.max(1, Math.floor(Math.max(gToken.length, tToken.length) / 3));
    if (dist <= maxTypos) {
        return { matches: true, penalty: 0.25 * dist, reason: "typo" };
    }
    if (tToken.includes(gToken) && gToken.length >= 4) {
        return { matches: true, penalty: 0.5, reason: "substring" };
    }
    return { matches: false, penalty: Infinity, reason: "none" };
}
function evaluateMatch(guess, target) {
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
                    const matchResult = matchToken(gStr, tStr);
                    if (matchResult.matches) {
                        matches.push({
                            gStart: i, gEnd: i + gLen - 1,
                            tStart: j, tEnd: j + tLen - 1,
                            gStr, tStr,
                            penalty: matchResult.penalty,
                            reason: matchResult.reason
                        });
                    }
                }
            }
        }
    }
    if (matches.length === 0)
        return { score: Infinity, penalty: Infinity, confidence: 0, bestReason: 'none' };
    matches.sort((a, b) => {
        if (a.penalty !== b.penalty)
            return a.penalty - b.penalty;
        const lenA = a.gEnd - a.gStart + a.tEnd - a.tStart;
        const lenB = b.gEnd - b.gStart + b.tEnd - b.tStart;
        return lenB - lenA;
    });
    let finalMatches = [];
    let gUsed = new Set();
    let tUsed = new Set();
    for (const m of matches) {
        let overlap = false;
        for (let i = m.gStart; i <= m.gEnd; i++)
            if (gUsed.has(i))
                overlap = true;
        for (let j = m.tStart; j <= m.tEnd; j++)
            if (tUsed.has(j))
                overlap = true;
        if (!overlap) {
            finalMatches.push(m);
            for (let i = m.gStart; i <= m.gEnd; i++)
                gUsed.add(i);
            for (let j = m.tStart; j <= m.tEnd; j++)
                tUsed.add(j);
        }
    }
    const matchedGChars = finalMatches.reduce((sum, m) => sum + m.gStr.length, 0);
    const totalGChars = gTokens.join('').length;
    const matchedTTokensCount = new Set(finalMatches.map((m) => m.tStart)).size;
    const totalTTokensCount = tTokens.length;
    const unmatchedTTokensCount = totalTTokensCount - matchedTTokensCount;
    const totalMatchPenalty = finalMatches.reduce((sum, m) => sum + m.penalty, 0);
    const unmatchedGCharsPenalty = (totalGChars - matchedGChars) * 0.3;
    const unmatchedTTokensPenalty = unmatchedTTokensCount * 0.05;
    const totalScore = totalMatchPenalty + unmatchedGCharsPenalty + unmatchedTTokensPenalty;
    const confidence = Math.max(0, 1 - totalScore / 2.0);
    const bestReason = finalMatches[0]?.reason || 'none';
    return { score: totalScore, penalty: totalMatchPenalty, confidence, bestReason };
}
//# sourceMappingURL=guess-matcher.util.js.map