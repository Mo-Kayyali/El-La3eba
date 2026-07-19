"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBestOfNMatchWin = checkBestOfNMatchWin;
function checkBestOfNMatchWin(state) {
    const ms = state.modeState;
    const requiredWins = Math.ceil((state.composition?.length || 3) / 2);
    if (ms.overallScores[state.players[0]] >= requiredWins ||
        ms.overallScores[state.players[1]] >= requiredWins ||
        ms.currentRound >= (state.composition?.length || 3)) {
        const p0Score = ms.overallScores[state.players[0]];
        const p1Score = ms.overallScores[state.players[1]];
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