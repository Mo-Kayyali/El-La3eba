export interface EloResult {
    winnerNewMmr: number;
    loserNewMmr: number;
    winnerDelta: number;
    loserDelta: number;
}
export declare function scoreMarginMultiplier(winnerOverall: number, loserOverall: number): number;
export declare function calculateElo(winnerMmr: number, loserMmr: number, kFactor?: number, marginMult?: number): EloResult;
export declare function calculateEloDraw(mmrA: number, mmrB: number, kFactor?: number): {
    newMmrA: number;
    newMmrB: number;
    deltaA: number;
    deltaB: number;
};
