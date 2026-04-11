"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateElo = calculateElo;
function calculateElo(winnerMmr, loserMmr, kFactor = 32) {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserMmr - winnerMmr) / 400));
    const expectedLoser = 1 - expectedWinner;
    const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
    const loserDelta = Math.round(kFactor * (0 - expectedLoser));
    return {
        winnerNewMmr: winnerMmr + winnerDelta,
        loserNewMmr: Math.max(100, loserMmr + loserDelta),
        winnerDelta,
        loserDelta,
    };
}
//# sourceMappingURL=elo.util.js.map