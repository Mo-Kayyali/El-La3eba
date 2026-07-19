"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreMarginMultiplier = scoreMarginMultiplier;
exports.calculateElo = calculateElo;
exports.calculateEloDraw = calculateEloDraw;
function scoreMarginMultiplier(winnerOverall, loserOverall) {
    const diff = winnerOverall - loserOverall;
    if (diff >= 2)
        return 1.25;
    return 1.0;
}
function calculateElo(winnerMmr, loserMmr, kFactor = 32, marginMult = 1) {
    const m = Math.max(1, marginMult);
    const expectedWinner = 1 / (1 + Math.pow(10, (loserMmr - winnerMmr) / 400));
    const expectedLoser = 1 - expectedWinner;
    const winnerDelta = Math.round(kFactor * m * (1 - expectedWinner));
    const loserDelta = Math.round(kFactor * m * (0 - expectedLoser));
    return {
        winnerNewMmr: winnerMmr + winnerDelta,
        loserNewMmr: Math.max(100, loserMmr + loserDelta),
        winnerDelta,
        loserDelta,
    };
}
function calculateEloDraw(mmrA, mmrB, kFactor = 32) {
    const expectedA = 1 / (1 + Math.pow(10, (mmrB - mmrA) / 400));
    const expectedB = 1 - expectedA;
    const deltaA = Math.round(kFactor * (0.5 - expectedA));
    const deltaB = Math.round(kFactor * (0.5 - expectedB));
    return {
        newMmrA: Math.max(100, mmrA + deltaA),
        newMmrB: Math.max(100, mmrB + deltaB),
        deltaA,
        deltaB,
    };
}
//# sourceMappingURL=elo.util.js.map