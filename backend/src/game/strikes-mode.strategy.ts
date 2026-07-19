import { GameModeStrategy, GuessResult, HandleGuessOutcome, DisconnectOutcome, ForfeitOutcome } from './game-mode.strategy';

export class StrikesModeStrategy implements GameModeStrategy {
  getOpponent(state: any, userId: string): string {
    return state.players.find((p: string) => p !== userId) || state.players[0];
  }

  checkMatchWinCondition(state: any): { isMatchOver: boolean; winnerId: string | null } {
    const ms = state.modeState;
    if (ms.overallScores[state.players[0]] >= 2 || ms.currentRound >= 3 || ms.overallScores[state.players[1]] >= 2) {
      return {
        isMatchOver: true,
        winnerId: ms.overallScores[state.players[0]] > ms.overallScores[state.players[1]]
          ? state.players[0]
          : state.players[1]
      };
    }
    return { isMatchOver: false, winnerId: null };
  }

  handleDisconnectTimeout(state: any, disconnectedUserId: string): DisconnectOutcome {
    const winnerId = this.getOpponent(state, disconnectedUserId);
    state.status = 'match_completed';
    state.winner = winnerId;
    return {
      updatedState: state,
      isMatchOver: true,
      winnerId
    };
  }

  handleForfeit(state: any, forfeitingUserId: string): ForfeitOutcome {
    const winnerId = this.getOpponent(state, forfeitingUserId);
    state.status = 'match_completed';
    state.winner = winnerId;

    const ms = state.modeState;
    if (!Array.isArray(ms.roundHistory)) ms.roundHistory = [];
    if (!ms.roundHistory.some((r: any) => r?.round === ms.currentRound)) {
      ms.roundHistory.push({
        round: ms.currentRound,
        winner: winnerId,
        scores: { ...(ms.scores ?? {}) },
      });
    }

    return { updatedState: state, winnerId };
  }

  handleTurnTimeout(state: any, userId: string): HandleGuessOutcome {
    const ms = state.modeState;
    ms.strikes[userId] = (ms.strikes[userId] ?? 0) + 1;
    return this.evaluateRoundState(state, userId);
  }

  handleGuess(state: any, userId: string, guessResult: GuessResult): HandleGuessOutcome {
    const ms = state.modeState;
    if (ms.currentTurn && ms.currentTurn !== userId) {
      return { error: 'Not your turn' };
    }

    if (guessResult.isCorrect) {
      ms.guessedPlayers.push({
        name: guessResult.matchedPlayer.name,
        guessText: guessResult.guessName,
        guessedBy: userId,
        isCorrect: true,
        playerId: guessResult.matchedPlayer.id,
      });
      ms.scores[userId] += 1;
    } else {
      ms.strikes[userId] += 1;
      ms.guessedPlayers.push({
        name: guessResult.matchedPlayer ? guessResult.matchedPlayer.name : guessResult.guessName,
        guessText: guessResult.guessName,
        guessedBy: userId,
        isCorrect: false,
        playerId: guessResult.matchedPlayer ? guessResult.matchedPlayer.id : null,
      });
    }

    return this.evaluateRoundState(state, userId);
  }

  private evaluateRoundState(state: any, lastActiveUserId: string): HandleGuessOutcome {
    const ms = state.modeState;
    let isRoundOver = false;
    let isMatchOver = false;
    let roundWinner: string | null = null;
    const opponent = this.getOpponent(state, lastActiveUserId);

    if (ms.strikes[lastActiveUserId] >= 3) {
      isRoundOver = true;
      roundWinner = opponent;

      // Update overall scores
      ms.overallScores[opponent] += 1;

      const winCondition = this.checkMatchWinCondition(state);
      if (winCondition.isMatchOver) {
        isMatchOver = true;
        state.status = 'match_completed';
        state.winner = winCondition.winnerId;
      } else {
        // Round ends, but match continues: transition period.
        ms.currentTurn = null;
      }
    } else {
      ms.currentTurn = opponent;
      ms.turnDeadlineAt = Date.now() + 10_000;
    }

    return {
      updatedState: state,
      isRoundOver,
      isMatchOver,
      roundWinner
    };
  }

  setupNextRound(state: any): void {
    const ms = state.modeState;
    ms.strikes = { [state.players[0]]: 0, [state.players[1]]: 0 };
    // Alternate round starters (BO3): R1 players[0], R2 players[1], R3 players[0]
    if (ms.currentRound === 2) ms.currentTurn = state.players[1];
    else if (ms.currentRound === 3) ms.currentTurn = state.players[0];
    else ms.currentTurn = state.players[0];
    ms.turnDeadlineAt = Date.now() + 10_000;
  }
}
