import { GameModeStrategy, GuessResult, HandleGuessOutcome, DisconnectOutcome, ForfeitOutcome } from './game-mode.strategy';
export declare class Top10ModeStrategy implements GameModeStrategy {
    getOpponent(state: any, userId: string): string;
    checkMatchWinCondition(state: any): {
        isMatchOver: boolean;
        winnerId: string | null;
    };
    handleDisconnectTimeout(state: any, disconnectedUserId: string): DisconnectOutcome;
    handleForfeit(state: any, forfeitedByUserId: string): ForfeitOutcome;
    setupNextRound(state: any): void;
    handleTurnTimeout(state: any, timedOutUserId: string): HandleGuessOutcome;
    handleGuess(state: any, userId: string, guessResult: GuessResult): HandleGuessOutcome;
    private advanceTurn;
}
