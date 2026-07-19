import { GameModeStrategy, GuessResult, HandleGuessOutcome, DisconnectOutcome, ForfeitOutcome } from './game-mode.strategy';
export declare class StrikesModeStrategy implements GameModeStrategy {
    getOpponent(state: any, userId: string): string;
    checkMatchWinCondition(state: any): string | null;
    handleDisconnectTimeout(state: any, disconnectedUserId: string): DisconnectOutcome;
    handleForfeit(state: any, forfeitingUserId: string): ForfeitOutcome;
    handleTurnTimeout(state: any, userId: string): HandleGuessOutcome;
    handleGuess(state: any, userId: string, guessResult: GuessResult): HandleGuessOutcome;
    private evaluateRoundState;
    setupNextRound(state: any): void;
}
