"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Top10ModeStrategy = void 0;
class Top10ModeStrategy {
    getOpponent(state, userId) {
        return state.players.find((p) => p !== userId) || state.players[0];
    }
    checkMatchWinCondition(state) {
        const ms = state.modeState;
        let allRanksClaimed = true;
        for (let i = 1; i <= 10; i++) {
            if (!ms.claimedRanks || !ms.claimedRanks.includes(i)) {
                allRanksClaimed = false;
                break;
            }
        }
        const p1 = state.players[0];
        const p2 = state.players[1];
        const p1Wrong = ms.wrongGuesses?.[p1] ?? 0;
        const p2Wrong = ms.wrongGuesses?.[p2] ?? 0;
        const bothCapped = p1Wrong >= 3 && p2Wrong >= 3;
        if (allRanksClaimed || bothCapped) {
            const p1Score = ms.scores?.[p1] ?? 0;
            const p2Score = ms.scores?.[p2] ?? 0;
            if (p1Score > p2Score) {
                return { isMatchOver: true, winnerId: p1 };
            }
            else if (p2Score > p1Score) {
                return { isMatchOver: true, winnerId: p2 };
            }
            else {
                return { isMatchOver: true, winnerId: null };
            }
        }
        return { isMatchOver: false, winnerId: null };
    }
    handleDisconnectTimeout(state, disconnectedUserId) {
        const winnerId = this.getOpponent(state, disconnectedUserId);
        state.status = 'match_completed';
        state.winner = winnerId;
        return {
            updatedState: state,
            isMatchOver: true,
            winnerId,
        };
    }
    handleForfeit(state, forfeitedByUserId) {
        const winnerId = this.getOpponent(state, forfeitedByUserId);
        state.status = 'match_completed';
        state.winner = winnerId;
        return {
            updatedState: state,
            winnerId,
        };
    }
    setupNextRound(state) {
        throw new Error('setupNextRound should never be called for Top10ModeStrategy');
    }
    handleTurnTimeout(state, timedOutUserId) {
        const ms = state.modeState;
        if (!ms.wrongGuesses) {
            ms.wrongGuesses = { [state.players[0]]: 0, [state.players[1]]: 0 };
        }
        ms.wrongGuesses[timedOutUserId] += 1;
        const winCondition = this.checkMatchWinCondition(state);
        if (winCondition.isMatchOver) {
            state.status = 'match_completed';
            state.winner = winCondition.winnerId;
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
    handleGuess(state, userId, guessResult) {
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
            if (ms.claimedRanks.includes(rank)) {
                return { error: 'Rank already claimed' };
            }
            ms.claimedRanks.push(rank);
            ms.guessedPlayers.push({ name: guessResult.matchedPlayer?.name, rank, guessedBy: userId });
            if (rank >= 1 && rank <= 10) {
                ms.scores[userId] += rank;
            }
            else if (rank === 11) {
                ms.scores[userId] -= 3;
            }
            else if (rank === 12) {
                ms.scores[userId] -= 2;
            }
            else if (rank === 13) {
                ms.scores[userId] -= 1;
            }
        }
        else {
            ms.wrongGuesses[userId] += 1;
            ms.guessedPlayers.push({ name: guessResult.guessName, isWrong: true, guessedBy: userId });
        }
        const winCondition = this.checkMatchWinCondition(state);
        if (winCondition.isMatchOver) {
            state.status = 'match_completed';
            state.winner = winCondition.winnerId;
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
    advanceTurn(state, currentPlayer) {
        const ms = state.modeState;
        const opponent = this.getOpponent(state, currentPlayer);
        if ((ms.wrongGuesses?.[opponent] ?? 0) < 3) {
            ms.currentTurn = opponent;
        }
        else {
            ms.currentTurn = currentPlayer;
        }
        ms.turnDeadlineAt = Date.now() + 15_000;
    }
}
exports.Top10ModeStrategy = Top10ModeStrategy;
//# sourceMappingURL=top10-mode.strategy.js.map