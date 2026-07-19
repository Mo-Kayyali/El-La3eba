export interface GuessResult {
    isCorrect: boolean;
    matchedPlayer: any | null;
    guessName: string;
    answerDetails?: {
        rank?: number | null;
        slotLabel?: string | null;
    } | null;
}
export interface HandleGuessOutcome {
    error?: string;
    updatedState?: any;
    isRoundOver?: boolean;
    isMatchOver?: boolean;
    roundWinner?: string | null;
}
export interface DisconnectOutcome {
    updatedState: any;
    isMatchOver: boolean;
    winnerId: string;
}
export interface ForfeitOutcome {
    updatedState: any;
    winnerId: string;
}
export interface GameModeStrategy {
    handleGuess(state: any, userId: string, guessResult: GuessResult): HandleGuessOutcome;
    handleTurnTimeout(state: any, userId: string): HandleGuessOutcome;
    checkMatchWinCondition(state: any): {
        isMatchOver: boolean;
        winnerId: string | null;
    };
    handleDisconnectTimeout(state: any, disconnectedUserId: string): DisconnectOutcome;
    handleForfeit(state: any, forfeitingUserId: string): ForfeitOutcome;
    getOpponent(state: any, userId: string): string;
    setupNextRound(state: any): void;
}
