export interface GuessResult {
  isCorrect: boolean;
  matchedPlayer: any | null;
  guessName: string;
  answerDetails?: { rank?: number | null; slotLabel?: string | null } | null;
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
  /**
   * Processes a player's guess.
   */
  handleGuess(state: any, userId: string, guessResult: GuessResult): HandleGuessOutcome;

  /**
   * Processes a player's turn timing out.
   */
  handleTurnTimeout(state: any, userId: string): HandleGuessOutcome;

  /**
   * Checks if the match has been won based on the current state.
   */
  checkMatchWinCondition(state: any): { isMatchOver: boolean; winnerId: string | null };

  /**
   * Applies forfeit/timeout logic when a player disconnects for too long.
   */
  handleDisconnectTimeout(state: any, disconnectedUserId: string): DisconnectOutcome;

  /**
   * Handles an explicit forfeit (voluntary or involuntary). Responsible for
   * updating modeState fields (roundHistory, currentRound snapshot, scores)
   * so the gateway never touches modeState fields directly.
   */
  handleForfeit(state: any, forfeitingUserId: string): ForfeitOutcome;

  /**
   * Gets the opponent for a given user (2-player explicitly).
   */
  getOpponent(state: any, userId: string): string;

  /**
   * Sets up mode-specific state for the next round.
   */
  setupNextRound(state: any): void;
}
