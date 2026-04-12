"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreMarginMultiplier = scoreMarginMultiplier;
exports.calculateElo = calculateElo;
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
//# sourceMappingURL=elo.util.js.map