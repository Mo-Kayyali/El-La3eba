export declare function levenshtein(a: string, b: string): number;
export declare function getTokenCombinations(tokens: string[]): string[];
export declare function matchToken(gToken: string, tToken: string): {
    matches: boolean;
    penalty: number;
    reason: string;
};
export declare function evaluateMatch(guess: string, target: string): {
    score: number;
    penalty: number;
    confidence: number;
};
