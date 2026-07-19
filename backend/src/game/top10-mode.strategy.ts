import {
  GameModeStrategy,
  GuessResult,
  HandleGuessOutcome,
  DisconnectOutcome,
  ForfeitOutcome,
} from './game-mode.strategy';

export class Top10ModeStrategy implements GameModeStrategy {
  getOpponent(state: any, userId: string): string {
    return state.players.find((p: string) => p !== userId) || state.players[0];
  }

  checkMatchWinCondition(state: any): { isMatchOver: boolean; winnerId: string | null } {
    const ms = state.modeState;
    
    // Check if match is over: all 10 real ranks claimed OR both players capped
    let allRanksClaimed = true;
    for (let i = 1; i <= 10; i++) {
      if (!ms.claimedRanks || !ms.claimedRanks.includes(i)) {
        allRanksClaimed = false;
        break;
      }
    }

    const p1 = state.players[0];
    const p2 = state.players[1];
    
    // Fallback initialized caps if undefined
    const p1Wrong = ms.wrongGuesses?.[p1] ?? 0;
    const p2Wrong = ms.wrongGuesses?.[p2] ?? 0;
    const bothCapped = p1Wrong >= 3 && p2Wrong >= 3;

    if (allRanksClaimed || bothCapped) {
      const p1Score = ms.scores?.[p1] ?? 0;
      const p2Score = ms.scores?.[p2] ?? 0;

      if (p1Score > p2Score) {
        return { isMatchOver: true, winnerId: p1 };
      } else if (p2Score > p1Score) {
        return { isMatchOver: true, winnerId: p2 };
      } else {
        // Genuine draw
        return { isMatchOver: true, winnerId: null };
      }
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
      winnerId,
    };
  }

  handleForfeit(state: any, forfeitedByUserId: string): ForfeitOutcome {
    const winnerId = this.getOpponent(state, forfeitedByUserId);
    state.status = 'match_completed';
    state.winner = winnerId;
    return {
      updatedState: state,
      winnerId,
    };
  }

  setupNextRound(state: any): void {
    // Top 10 mode is a single round.
    throw new Error('setupNextRound should never be called for Top10ModeStrategy');
  }

  handleTurnTimeout(state: any, timedOutUserId: string): HandleGuessOutcome {
    const ms = state.modeState;
    if (!ms.wrongGuesses) {
      ms.wrongGuesses = { [state.players[0]]: 0, [state.players[1]]: 0 };
    }

    ms.wrongGuesses[timedOutUserId] += 1;

    const winCondition = this.checkMatchWinCondition(state);
    if (winCondition.isMatchOver) {
      state.status = 'match_completed';
      state.winner = winCondition.winnerId;
      // Also copy final scores to overallScores so MMR works correctly
      if (!ms.overallScores) {
         ms.overallScores = {};
      }
      ms.overallScores[state.players[0]] = ms.scores[state.players[0]];
      ms.overallScores[state.players[1]] = ms.scores[state.players[1]];
      
      return {
        updatedState: state,
        isRoundOver: true,
        isMatchOver: true,
        roundWinner: winCondition.winnerId,
      };
    }

    this.advanceTurn(state, timedOutUserId);

    return { updatedState: state };
  }

  handleGuess(state: any, userId: string, guessResult: GuessResult): HandleGuessOutcome {
    if (state.modeState.currentTurn !== userId) {
      return { error: 'Not your turn' };
    }

    const ms = state.modeState;
    const opponent = this.getOpponent(state, userId);

    if (!ms.wrongGuesses) {
      ms.wrongGuesses = { [state.players[0]]: 0, [state.players[1]]: 0 };
    }
    if (!ms.scores) {
      ms.scores = { [state.players[0]]: 0, [state.players[1]]: 0 };
    }
    if (!ms.claimedRanks) {
      ms.claimedRanks = [];
    }
    if (!ms.guessedPlayers) {
      ms.guessedPlayers = [];
    }

    const rank = guessResult.answerDetails?.rank;

    if (guessResult.isCorrect && rank !== undefined && rank !== null) {
      // Check if rank is already claimed
      if (ms.claimedRanks.includes(rank)) {
        // Clean reject, no penalty
        return { error: 'Rank already claimed' };
      }

      ms.claimedRanks.push(rank);
      ms.guessedPlayers.push({ name: guessResult.matchedPlayer?.name, rank, guessedBy: userId });

      if (rank >= 1 && rank <= 10) {
        ms.scores[userId] += rank;
      } else if (rank === 11) {
        ms.scores[userId] -= 3;
      } else if (rank === 12) {
        ms.scores[userId] -= 2;
      } else if (rank === 13) {
        ms.scores[userId] -= 1;
      }
    } else {
      ms.wrongGuesses[userId] += 1;
      ms.guessedPlayers.push({ name: guessResult.guessName, isWrong: true, guessedBy: userId });
    }

    const winCondition = this.checkMatchWinCondition(state);
    if (winCondition.isMatchOver) {
      state.status = 'match_completed';
      state.winner = winCondition.winnerId;
      // Also copy final scores to overallScores so MMR works correctly
      if (!ms.overallScores) {
         ms.overallScores = {};
      }
      ms.overallScores[state.players[0]] = ms.scores[state.players[0]];
      ms.overallScores[state.players[1]] = ms.scores[state.players[1]];
      
      return {
        updatedState: state,
        isRoundOver: true,
        isMatchOver: true,
        roundWinner: winCondition.winnerId,
      };
    }

    this.advanceTurn(state, userId);

    return { updatedState: state };
  }

  private advanceTurn(state: any, currentPlayer: string) {
    const ms = state.modeState;
    const opponent = this.getOpponent(state, currentPlayer);
    
    // Pass turn to opponent if opponent hasn't reached the cap of 3
    if ((ms.wrongGuesses?.[opponent] ?? 0) < 3) {
      ms.currentTurn = opponent;
    } else {
      // Keep turn if opponent is capped (since match isn't over, current player must be < 3)
      ms.currentTurn = currentPlayer;
    }
    // Turn timeout is 15 seconds as per design
    ms.turnDeadlineAt = Date.now() + 15_000;
  }
}
