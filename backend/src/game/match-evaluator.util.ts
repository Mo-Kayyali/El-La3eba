/**
 * Determines whether a best-of-N match is over.
 *
 * Threshold formula: Math.floor(N / 2) + 1  (strict majority)
 *   N=1 → 1,  N=2 → 2,  N=3 → 2,  N=4 → 3,  N=5 → 3
 *
 * This is correct for both odd AND even compositions.
 * The old Math.ceil(N/2) formula was wrong for even N:
 *   e.g. N=2 gave threshold=1, ending the match after a single round win.
 *
 * Early-exit: if one player has already reached the threshold, end immediately
 * (no need to play out remaining rounds).
 * End-of-composition: when all rounds are done (currentRound >= N), evaluate
 * the final score; a tie produces winnerId: null (draw, no MMR change).
 */
export function checkBestOfNMatchWin(state: any): { isMatchOver: boolean; winnerId: string | null } {
  const ms = state.modeState;
  const compositionLength: number = state.composition?.length || 3;
  // Strict majority: the minimum wins needed to guarantee the opponent
  // cannot catch up even if they win every remaining round.
  const requiredWins = Math.floor(compositionLength / 2) + 1;

  const p0Score: number = ms.overallScores[state.players[0]] ?? 0;
  const p1Score: number = ms.overallScores[state.players[1]] ?? 0;

  const earlyWinner = p0Score >= requiredWins || p1Score >= requiredWins;
  const allRoundsPlayed = ms.currentRound >= compositionLength;

  if (earlyWinner || allRoundsPlayed) {
    if (p0Score > p1Score) {
      return { isMatchOver: true, winnerId: state.players[0] };
    } else if (p1Score > p0Score) {
      return { isMatchOver: true, winnerId: state.players[1] };
    } else {
      return { isMatchOver: true, winnerId: null };
    }
  }
  return { isMatchOver: false, winnerId: null };
}
