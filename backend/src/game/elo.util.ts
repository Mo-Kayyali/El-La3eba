export interface EloResult {
  winnerNewMmr: number;
  loserNewMmr: number;
  winnerDelta: number;
  loserDelta: number;
}

/**
 * Multiplier from set score (best-of-3): a 2–0 win moves ratings more than a 2–1.
 * Expect winnerOverall === 2 at match end for normal finishes.
 */
export function scoreMarginMultiplier(
  winnerOverall: number,
  loserOverall: number,
): number {
  const diff = winnerOverall - loserOverall;
  if (diff >= 2) return 1.25;
  return 1.0;
}

/**
 * Calculates standard Elo rating changes for a single match outcome.
 *
 * Formula:
 *   Expected score  E_A = 1 / (1 + 10^((R_B - R_A) / 400))
 *   New rating      R_A' = R_A + K * M * (S_A - E_A)
 *     where S_A = 1 (win) or 0 (loss), M = scoreMarginMultiplier (default 1)
 *
 * @param winnerMmr - Current MMR of the winning player
 * @param loserMmr  - Current MMR of the losing player
 * @param kFactor   - Volatility constant (default: 32 — standard for online games)
 * @param marginMult - Extra scaling from margin of victory (e.g. 1.25 for 2–0, 1.2 for forfeit)
 */
export function calculateElo(
  winnerMmr: number,
  loserMmr: number,
  kFactor = 32,
  marginMult = 1,
): EloResult {
  const m = Math.max(1, marginMult);
  const expectedWinner = 1 / (1 + Math.pow(10, (loserMmr - winnerMmr) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerDelta = Math.round(kFactor * m * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * m * (0 - expectedLoser)); // always negative or zero

  return {
    winnerNewMmr: winnerMmr + winnerDelta,
    loserNewMmr: Math.max(100, loserMmr + loserDelta), // floor at 100 to avoid de-ranking to 0
    winnerDelta,
    loserDelta,
  };
}

/**
 * Calculates standard Elo rating changes for a draw.
 * Both ratings move toward the expected outcome symmetric to the rating gap.
 */
export function calculateEloDraw(
  mmrA: number,
  mmrB: number,
  kFactor = 32,
): { newMmrA: number; newMmrB: number; deltaA: number; deltaB: number } {
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
