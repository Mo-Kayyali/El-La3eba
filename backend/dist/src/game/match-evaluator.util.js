"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBestOfNMatchWin = checkBestOfNMatchWin;
function checkBestOfNMatchWin(state) {
    const ms = state.modeState;
    const compositionLength = state.composition?.length || 3;
    const requiredWins = Math.floor(compositionLength / 2) + 1;
    const p0Score = ms.overallScores[state.players[0]] ?? 0;
    const p1Score = ms.overallScores[state.players[1]] ?? 0;
    const earlyWinner = p0Score >= requiredWins || p1Score >= requiredWins;
    const allRoundsPlayed = ms.currentRound >= compositionLength;
    if (earlyWinner || allRoundsPlayed) {
        if (p0Score > p1Score) {
            return { isMatchOver: true, winnerId: state.players[0] };
        }
        else if (p1Score > p0Score) {
            return { isMatchOver: true, winnerId: state.players[1] };
        }
        else {
            return { isMatchOver: true, winnerId: null };
        }
    }
    return { isMatchOver: false, winnerId: null };
}
//# sourceMappingURL=match-evaluator.util.js.map