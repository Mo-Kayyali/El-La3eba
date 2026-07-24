"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const guess_matcher_util_1 = require("./src/game/guess-matcher.util");
const prisma = new client_1.PrismaClient();
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
    const unmatchedGCharsPenalty = (totalGChars - matchedGChars) * 0.4;
    const unmatchedTTokensPenalty = unmatchedTTokensCount * 0.05;
    const totalScore = totalMatchPenalty + unmatchedGCharsPenalty + unmatchedTTokensPenalty;
    const confidence = Math.max(0, 1 - totalScore / (gTokens.length + 0.5));
    const bestReason = finalMatches[0]?.reason || 'none';
    return { score: totalScore, penalty: totalMatchPenalty, confidence, bestReason };
}
async function resolveGuessProposed(guessName) {
    const normalizedGuess = guessName.trim().replace(/-/g, ' ');
    const guessLen = normalizedGuess.length;
    if (guessLen < 3)
        return { validCandidates: [], isAmbiguous: false, ambiguityReason: 'Length < 3' };
    await prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.2;`);
    const rawCandidates = await prisma.$queryRaw `
    WITH guess AS (
      SELECT lower(unaccent(${normalizedGuess})) AS val
    ),
    player_metrics AS (
      SELECT 
        p.*,
        c.name as "currentClubName",
        c.competitions as "currentClubCompetitions",
        g.val,
        GREATEST(
          word_similarity(g.val, replace(lower(unaccent_immutable(p.name)), '-', ' ')),
          word_similarity(g.val, replace(lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))), '-', ' '))
        ) as w_sim
      FROM "Player" p
      LEFT JOIN "Club" c ON p."currentClubId" = c.id
      CROSS JOIN guess g
      WHERE
        (
          lower(unaccent_immutable(p.name)) %> g.val OR
          lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> g.val
        )
    )
    SELECT *
    FROM player_metrics
    ORDER BY w_sim DESC
    LIMIT 20;
  `;
    const scoredCandidates = rawCandidates.map((c) => {
        let bestConfidence = 0;
        let bestTarget = '';
        let bestReason = '';
        const targets = [c.name, ...(c.aliases || [])];
        for (const target of targets) {
            const result = evaluateMatchProposed(normalizedGuess, target);
            if (result.confidence > bestConfidence) {
                bestConfidence = result.confidence;
                bestTarget = target;
                bestReason = result.bestReason;
            }
        }
        return { ...c, matchConfidence: bestConfidence, bestTarget, bestReason };
    });
    const validCandidates = scoredCandidates
        .filter((c) => c.matchConfidence >= 0.3)
        .sort((a, b) => {
        if (Math.abs(b.matchConfidence - a.matchConfidence) > 0.001) {
            return b.matchConfidence - a.matchConfidence;
        }
        return Number(b.w_sim) - Number(a.w_sim);
    })
        .slice(0, 10);
    let isAmbiguous = false;
    let ambiguityReason = 'Unambiguous';
    if (validCandidates.length > 1) {
        const c0 = validCandidates[0];
        const c1 = validCandidates[1];
        const gap = c0.matchConfidence - c1.matchConfidence;
        if (c0.bestReason === 'exact' && c1.bestReason === 'exact' && gap <= 0.01) {
            isAmbiguous = true;
            ambiguityReason = `Tied exact match (gap ${gap.toFixed(3)} <= 0.01)`;
        }
    }
    if (validCandidates.length > 0) {
        validCandidates[0].isAmbiguous = isAmbiguous;
    }
    return { validCandidates, isAmbiguous, ambiguityReason };
}
async function main() {
    console.log('=== REGRESSION MATRIX: PROPOSED MATCHING & AMBIGUITY FORMULA ===\n');
    const testCases = [
        { input: 'messi', expected: 'Lionel Messi' },
        { input: 'mbappe', expected: 'Kylian Mbappe' },
        { input: 'salah', expected: 'Mohamed Salah' },
        { input: 'ronaldo', expected: 'Cristiano Ronaldo / Ronaldo Nazário' },
        { input: 'beckham', expected: 'David Beckham' },
        { input: 'haaland', expected: 'Erling Haaland' },
        { input: 'kane', expected: 'Harry Kane' },
        { input: 'benzema', expected: 'Karim Benzema' },
        { input: 'ramadan', expected: 'Ramadan Sobhi' },
        { input: 'neymar', expected: 'Neymar da Silva Santos' },
        { input: 'pedri', expected: 'Pedri' },
        { input: 'gavi', expected: 'Gavi' },
        { input: 'modric', expected: 'Luka Modric' },
        { input: 'ahmed', expected: 'GENUINELY AMBIGUOUS (Multiple Ahmeds)' },
        { input: 'mohamed', expected: 'GENUINELY AMBIGUOUS (Multiple Mohamed)' },
        { input: 'sobhi ramadan', expected: 'Ramadan Sobhi' },
        { input: 'bekham', expected: 'David Beckham' },
        { input: 'benromdhane', expected: 'Mohamed Ali Ben Romdhane' },
        { input: 'ben ramadan', expected: 'Ahmed Ramadan Beckham / Ramadan Sobhi' },
        { input: 'lionel messi', expected: 'Lionel Messi' },
        { input: 'kylian mbappe', expected: 'Kylian Mbappe' },
        { input: 'david beckham', expected: 'David Beckham' },
        { input: 'cristiano ronaldo', expected: 'Cristiano Ronaldo' },
        { input: 'mohamed salah', expected: 'Mohamed Salah' },
    ];
    const results = [];
    for (const tc of testCases) {
        const { validCandidates, isAmbiguous, ambiguityReason } = await resolveGuessProposed(tc.input);
        const c0 = validCandidates[0];
        const c1 = validCandidates[1];
        results.push({
            input: tc.input,
            expected: tc.expected,
            topCandidate: c0 ? `${c0.name} (${c0.bestTarget})` : 'NONE',
            cand0Conf: c0 ? c0.matchConfidence.toFixed(3) : 'N/A',
            cand1Candidate: c1 ? `${c1.name}` : 'N/A',
            cand1Conf: c1 ? c1.matchConfidence.toFixed(3) : 'N/A',
            isAmbiguous: isAmbiguous ? 'YES' : 'NO',
            finalResolution: isAmbiguous
                ? 'AMBIGUOUS (STRIKE)'
                : c0
                    ? `RESOLVED: ${c0.name}`
                    : 'NONE FOUND',
        });
    }
    console.table(results);
}
main()
    .catch((e) => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=test-proposed-formula.js.map