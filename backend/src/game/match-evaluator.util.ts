export function checkBestOfNMatchWin(state: any): { isMatchOver: boolean; winnerId: string | null } {
  const ms = state.modeState;
  // TODO: Hardcoded majority threshold (2) is only correct for the fixed 3-round Ranked/Unrated composition.
  // Must generalize to Math.ceil(composition.length / 2) when Private Room variable-length compositions ship.
  const requiredWins = 2;
  if (
    ms.overallScores[state.players[0]] >= requiredWins ||
    ms.overallScores[state.players[1]] >= requiredWins ||
    ms.currentRound >= (state.composition?.length || 3)
  ) {
    const p0Score = ms.overallScores[state.players[0]];
    const p1Score = ms.overallScores[state.players[1]];
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
