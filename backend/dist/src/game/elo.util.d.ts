export interface EloResult {
    winnerNewMmr: number;
    loserNewMmr: number;
    winnerDelta: number;
    loserDelta: number;
}
export declare function scoreMarginMultiplier(winnerOverall: number, loserOverall: number): number;
export declare function calculateElo(winnerMmr: number, loserMmr: number, kFactor?: number, marginMult?: number): EloResult;
