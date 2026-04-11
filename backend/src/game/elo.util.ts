export interface EloResult {
  winnerNewMmr: number;
  loserNewMmr: number;
  winnerDelta: number;
  loserDelta: number;
}

/**
 * Calculates standard Elo rating changes for a single match outcome.
 *
 * Formula:
 *   Expected score  E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *   New rating      R_A' = R_A + K * (S_A - E_A)
 *     where S_A = 1 (win) or 0 (loss)
 *
 * @param winnerMmr - Current MMR of the winning player
 * @param loserMmr  - Current MMR of the losing player
 * @param kFactor   - Volatility constant (default: 32 — standard for online games)
 */
export function calculateElo(
  winnerMmr: number,
  loserMmr: number,
  kFactor = 32,
): EloResult {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserMmr - winnerMmr) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * (0 - expectedLoser)); // always negative

  return {
    winnerNewMmr: winnerMmr + winnerDelta,
    loserNewMmr: Math.max(100, loserMmr + loserDelta), // floor at 100 to avoid de-ranking to 0
    winnerDelta,
    loserDelta,
  };
}
