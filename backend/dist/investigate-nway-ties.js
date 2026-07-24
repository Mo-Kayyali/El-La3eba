"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const guess_matcher_util_1 = require("./src/game/guess-matcher.util");
const prisma = new client_1.PrismaClient();
async function runGuessPlayer(guessName) {
    const normalizedGuess = guessName.trim().replace(/-/g, ' ');
    if (normalizedGuess.length < 3)
        return [];
    const [_, rawCandidates] = await prisma.$transaction([
        prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.15;`),
        prisma.$queryRaw `
      WITH guess AS (
        SELECT lower(unaccent(${normalizedGuess})) AS val
      ),
      player_metrics AS (
        SELECT
          p.*,
          c.name as "currentClubName",
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
            lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> g.val OR
            similarity(lower(unaccent_immutable(p.name)), g.val) > 0.15
          )
      )
      SELECT *
      FROM player_metrics
      ORDER BY w_sim DESC
      LIMIT 40;
    `
    ]);
    const candidateMap = new Map();
    for (const c of rawCandidates) {
        if (!candidateMap.has(c.id))
            candidateMap.set(c.id, c);
    }
    const uniqueCandidates = Array.from(candidateMap.values());
    const scoredCandidates = uniqueCandidates.map((c) => {
        let bestConfidence = 0;
        let bestTarget = c.name;
        let bestReason = 'none';
        let isMainNameMatch = false;
        const mainResult = (0, guess_matcher_util_1.evaluateMatch)(normalizedGuess, c.name);
        bestConfidence = mainResult.confidence;
        bestTarget = c.name;
        bestReason = mainResult.bestReason;
        isMainNameMatch = true;
        for (const alias of c.aliases || []) {
            const aliasResult = (0, guess_matcher_util_1.evaluateMatch)(normalizedGuess, alias);
            if (aliasResult.confidence > bestConfidence) {
                bestConfidence = aliasResult.confidence;
                bestTarget = alias;
                bestReason = aliasResult.bestReason;
                isMainNameMatch = false;
            }
        }
        return {
            ...c,
            matchConfidence: bestConfidence,
            bestTarget,
            bestReason,
            isMainNameMatch,
            clubsCount: (c.clubs || []).length,
            aliasesCount: (c.aliases || []).length,
        };
    });
    return scoredCandidates
        .filter((c) => c.matchConfidence >= 0.3)
        .sort((a, b) => {
        if (Math.abs(b.matchConfidence - a.matchConfidence) > 0.001)
            return b.matchConfidence - a.matchConfidence;
        if (a.aliasesCount !== b.aliasesCount)
            return b.aliasesCount - a.aliasesCount;
        if (a.clubsCount !== b.clubsCount)
            return b.clubsCount - a.clubsCount;
        if (a.isMainNameMatch !== b.isMainNameMatch)
            return a.isMainNameMatch ? -1 : 1;
        return Number(b.w_sim) - Number(a.w_sim);
    });
}
async function investigateTies(label, guess) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`GUESS: "${guess}" (${label})`);
    console.log('='.repeat(70));
    const candidates = await runGuessPlayer(guess);
    if (candidates.length === 0) {
        console.log('  No candidates found.');
        return;
    }
    const topConf = candidates[0].matchConfidence;
    const epsilon = 0.001;
    const nearTopGroup = candidates.filter(c => Math.abs(c.matchConfidence - topConf) <= epsilon);
    console.log(`\nTop confidence: ${(topConf * 100).toFixed(1)}%`);
    console.log(`Near-top group size (within ε=${epsilon}): ${nearTopGroup.length}`);
    console.log(`Total scored candidates: ${candidates.length}`);
    console.log(`\nNEAR-TOP GROUP (all tied at ~${(topConf * 100).toFixed(1)}%):`);
    for (const c of nearTopGroup) {
        console.log(`  [TIED] ${c.name.padEnd(35)} | conf=${(c.matchConfidence * 100).toFixed(1)}% | reason=${c.bestReason.padEnd(8)} | aliases=${c.aliasesCount} | clubs=${c.clubsCount} | mainName=${c.isMainNameMatch} | w_sim=${Number(c.w_sim).toFixed(3)}`);
    }
    const AMBIGUITY_THRESHOLD = 3;
    const pickedByOldLogic = candidates[0];
    const isAmbiguousOld = (candidates.length > 1 &&
        candidates[0].bestReason === 'exact' &&
        candidates[1].bestReason === 'exact' &&
        (candidates[0].matchConfidence - candidates[1].matchConfidence) <= 0.001 &&
        candidates[0].aliasesCount === candidates[1].aliasesCount &&
        candidates[0].clubsCount === candidates[1].clubsCount);
    const isAmbiguousNew = nearTopGroup.length > 1;
    console.log(`\nCURRENT AMBIGUITY RESULT (c0 vs c1 pairwise):`);
    console.log(`  Picked: "${pickedByOldLogic.name}" — isAmbiguous: ${isAmbiguousOld}`);
    console.log(`\nPROPOSED AMBIGUITY (N-way group >= 2 at top confidence):`);
    console.log(`  isAmbiguous: ${isAmbiguousNew} (${nearTopGroup.length} candidates in near-top group)`);
    if (candidates.length > nearTopGroup.length) {
        console.log(`\nNEXT CANDIDATE BELOW NEAR-TOP:`);
        const below = candidates[nearTopGroup.length];
        console.log(`  ${below.name} | conf=${(below.matchConfidence * 100).toFixed(1)}%`);
    }
}
async function main() {
    await investigateTies('REPORTED CASE', 'mohamed');
    await investigateTies('GENERIC FIRST NAME', 'ahmed');
    await investigateTies('GENERIC FIRST NAME', 'mahmoud');
    await investigateTies('GENERIC FIRST NAME', 'ali');
    await investigateTies('GENERIC FIRST NAME', 'omar');
    const matrixSingleToken = [
        ['messi', 'Lionel Messi'],
        ['mbappe', 'Kylian Mbappe'],
        ['salah', 'Mohamed Salah'],
        ['ronaldo', 'Ronaldo / CR7'],
        ['beckham', 'David Beckham'],
        ['haaland', 'Erling Haaland'],
        ['kane', 'Harry Kane'],
        ['benzema', 'Karim Benzema'],
        ['neymar', 'Neymar'],
        ['pedri', 'Pedri'],
        ['gavi', 'Gavi'],
        ['modric', 'Luka Modric'],
    ];
    console.log(`\n${'='.repeat(70)}`);
    console.log(`24-CASE SINGLE-TOKEN PARTIAL NAME MATRIX (regression check)`);
    console.log(`=`.repeat(70));
    console.log(`${'Input'.padEnd(16)} | ${'Expected'.padEnd(22)} | ${'Near-Top Count'.padEnd(14)} | ${'Proposed Ambiguous?'.padEnd(20)} | Picked`);
    console.log('-'.repeat(120));
    for (const [input, expected] of matrixSingleToken) {
        const candidates = await runGuessPlayer(input);
        if (candidates.length === 0) {
            console.log(`${input.padEnd(16)} | ${expected.padEnd(22)} | ${'0'.padEnd(14)} | ${'YES (no match)'.padEnd(20)} | NONE`);
            continue;
        }
        const topConf = candidates[0].matchConfidence;
        const epsilon = 0.001;
        const nearTopGroup = candidates.filter(c => Math.abs(c.matchConfidence - topConf) <= epsilon);
        const isAmbiguous = nearTopGroup.length > 1;
        const picked = candidates[0].name;
        console.log(`${input.padEnd(16)} | ${expected.padEnd(22)} | ${String(nearTopGroup.length).padEnd(14)} | ${String(isAmbiguous).padEnd(20)} | ${picked}`);
    }
}
main()
    .catch((e) => console.error(e))
    .finally(async () => { await prisma.$disconnect(); });
//# sourceMappingURL=investigate-nway-ties.js.map