import { GameModeStrategy, GuessResult, HandleGuessOutcome, DisconnectOutcome, ForfeitOutcome } from './game-mode.strategy';
export declare class Top10ModeStrategy implements GameModeStrategy {
    getOpponent(state: any, userId: string): string;
    private checkRoundWinCondition;
    handleDisconnectTimeout(state: any, disconnectedUserId: string): DisconnectOutcome;
    handleForfeit(state: any, forfeitedByUserId: string): ForfeitOutcome;
    initializeRoundState(state: any): void;
    handleTurnTimeout(state: any, timedOutUserId: string): HandleGuessOutcome;
    handleGuess(state: any, userId: string, guessResult: GuessResult): HandleGuessOutcome;
    private advanceTurn;
}
