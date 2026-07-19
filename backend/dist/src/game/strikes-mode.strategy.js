"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrikesModeStrategy = void 0;
class StrikesModeStrategy {
    getOpponent(state, userId) {
        return state.players.find((p) => p !== userId) || state.players[0];
    }
    handleDisconnectTimeout(state, disconnectedUserId) {
        const winnerId = this.getOpponent(state, disconnectedUserId);
        state.status = 'match_completed';
        state.winner = winnerId;
        return {
            updatedState: state,
            isMatchOver: true,
            winnerId
        };
    }
    handleForfeit(state, forfeitingUserId) {
        const winnerId = this.getOpponent(state, forfeitingUserId);
        state.status = 'match_completed';
        state.winner = winnerId;
        const ms = state.modeState;
        if (!Array.isArray(ms.roundHistory))
            ms.roundHistory = [];
        if (!ms.roundHistory.some((r) => r?.round === ms.currentRound)) {
            ms.roundHistory.push({
                round: ms.currentRound,
                winner: winnerId,
                scores: { ...(ms.scores ?? {}) },
            });
        }
        return { updatedState: state, winnerId };
    }
    handleTurnTimeout(state, userId) {
        const ms = state.modeState;
        ms.strikes[userId] = (ms.strikes[userId] ?? 0) + 1;
        return this.evaluateRoundState(state, userId);
    }
    handleGuess(state, userId, guessResult) {
        const ms = state.modeState;
        if (ms.currentTurn && ms.currentTurn !== userId) {
            return { error: 'Not your turn', isRoundOver: false };
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
        }
        else {
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
    evaluateRoundState(state, lastActiveUserId) {
        const ms = state.modeState;
        let isRoundOver = false;
        let isMatchOver = false;
        let roundWinner = null;
        const opponent = this.getOpponent(state, lastActiveUserId);
        if (ms.strikes[lastActiveUserId] >= 3) {
            isRoundOver = true;
            roundWinner = opponent;
            if (roundWinner !== null) {
                ms.overallScores[roundWinner] += 1;
            }
            else {
                ms.overallScores[state.players[0]] += 1;
                ms.overallScores[state.players[1]] += 1;
            }
            ms.currentTurn = null;
            return {
                updatedState: state,
                isRoundOver: true,
                roundWinner
            };
        }
        else {
            ms.currentTurn = opponent;
            ms.turnDeadlineAt = Date.now() + (state.turnTimerMs || 10_000);
            return {
                updatedState: state,
                isRoundOver: false
            };
        }
    }
    initializeRoundState(state) {
        const ms = state.modeState;
        ms.strikes = { [state.players[0]]: 0, [state.players[1]]: 0 };
        ms.scores = { [state.players[0]]: 0, [state.players[1]]: 0 };
        ms.guessedPlayers = [];
        if (ms.currentRound % 2 === 0) {
            ms.currentTurn = state.players[1];
        }
        else {
            ms.currentTurn = state.players[0];
        }
        ms.turnDeadlineAt = Date.now() + (state.turnTimerMs || 10_000);
    }
}
exports.StrikesModeStrategy = StrikesModeStrategy;
//# sourceMappingURL=strikes-mode.strategy.js.map