"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strikes_mode_strategy_1 = require("./src/game/strikes-mode.strategy");
const top10_mode_strategy_1 = require("./src/game/top10-mode.strategy");
const matchmaking_service_1 = require("./src/game/matchmaking.service");
const match_evaluator_util_1 = require("./src/game/match-evaluator.util");
function createMockService() {
    return {
        gameService: {
            getRandomQuestion: async (mode) => ({ id: 'mock-q-' + mode })
        },
        prisma: {
            user: {
                findUnique: async () => ({ mmr: 1000 })
            }
        },
        redisClient: {
            multi: () => ({ set: () => { }, exec: async () => [] })
        },
        setActiveGameSessionIdInMulti: () => { }
    };
}
function resolveStrategy(mode) {
    if (mode === 'TOP_10')
        return new top10_mode_strategy_1.Top10ModeStrategy();
    return new strikes_mode_strategy_1.StrikesModeStrategy();
}
async function simulateMatch(composition, matchName, scenarios) {
    console.log('\n=============================================');
    console.log(`Starting ${matchName}: ${composition.join(', ')}`);
    console.log('=============================================');
    const mms = new matchmaking_service_1.MatchmakingService(createMockService().redisClient, createMockService().prisma, createMockService().gameService);
    mms.setActiveGameSessionIdInMulti = () => { };
    const state = await mms.initializeGameState('session1', 'user1', 'user2', 'User One', 'User Two', true, composition);
    console.log(`[Start] Mode: ${state.mode}, Turn: ${state.modeState.currentTurn}`);
    for (let i = 0; i < scenarios.length; i++) {
        const scenario = scenarios[i];
        console.log(`\n--- Round ${state.modeState.currentRound} (${state.mode}) ---`);
        const strategy = resolveStrategy(state.mode);
        let outcome = scenario(state, strategy);
        let isRoundOver = outcome.isRoundOver ?? false;
        let roundWinner = 'roundWinner' in outcome ? (outcome.roundWinner ?? null) : null;
        let isMatchOver = false;
        if (isRoundOver) {
            const matchOutcome = (0, match_evaluator_util_1.checkBestOfNMatchWin)(state);
            isMatchOver = matchOutcome.isMatchOver;
            if (isMatchOver) {
                state.status = 'match_completed';
                state.winner = matchOutcome.winnerId;
            }
        }
        console.log(`Scores -> user1: ${state.modeState.scores['user1'] || 0}, user2: ${state.modeState.scores['user2'] || 0}`);
        console.log(`Round Winner: ${roundWinner || 'DRAW'}`);
        console.log(`Overall Scores -> user1: ${state.modeState.overallScores['user1']}, user2: ${state.modeState.overallScores['user2']}`);
        console.log(`Match Over: ${isMatchOver}`);
        if (isMatchOver) {
            console.log(`Match Winner: ${state.winner || 'DRAW'}`);
            break;
        }
        else {
            state.modeState.currentRound += 1;
            state.modeState.roundWinnerId = null;
            state.mode = state.composition[state.modeState.currentRound - 1];
            resolveStrategy(state.mode).initializeRoundState(state);
            console.log(`[Next Round Init] Mode: ${state.mode}, Turn: ${state.modeState.currentTurn}`);
        }
    }
}
async function run() {
    await simulateMatch(['STRIKES', 'STRIKES', 'TOP_10'], 'Mixed Mode Draw Test', [
        (state, strategy) => {
            state.modeState.currentTurn = 'user1';
            strategy.handleGuess(state, 'user1', { isCorrect: false, guessName: 'w1', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user2';
            strategy.handleGuess(state, 'user2', { isCorrect: true, guessName: 'r', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user1';
            strategy.handleGuess(state, 'user1', { isCorrect: false, guessName: 'w2', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user2';
            strategy.handleGuess(state, 'user2', { isCorrect: true, guessName: 'r', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user1';
            return strategy.handleGuess(state, 'user1', { isCorrect: false, guessName: 'w3', matchedPlayer: { name: 'a' } });
        },
        (state, strategy) => {
            state.modeState.currentTurn = 'user2';
            strategy.handleGuess(state, 'user2', { isCorrect: false, guessName: 'w1', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user1';
            strategy.handleGuess(state, 'user1', { isCorrect: true, guessName: 'r', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user2';
            strategy.handleGuess(state, 'user2', { isCorrect: false, guessName: 'w2', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user1';
            strategy.handleGuess(state, 'user1', { isCorrect: true, guessName: 'r', matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user2';
            return strategy.handleGuess(state, 'user2', { isCorrect: false, guessName: 'w3', matchedPlayer: { name: 'a' } });
        },
        (state, strategy) => {
            state.modeState.currentTurn = 'user1';
            strategy.handleGuess(state, 'user1', { isCorrect: true, answerDetails: { rank: 5 }, matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user1';
            strategy.handleGuess(state, 'user1', { isCorrect: true, answerDetails: { rank: 7 }, matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user2';
            strategy.handleGuess(state, 'user2', { isCorrect: true, answerDetails: { rank: 2 }, matchedPlayer: { name: 'a' } });
            state.modeState.currentTurn = 'user2';
            strategy.handleGuess(state, 'user2', { isCorrect: true, answerDetails: { rank: 10 }, matchedPlayer: { name: 'a' } });
            state.modeState.wrongGuesses['user1'] = 3;
            state.modeState.wrongGuesses['user2'] = 2;
            state.modeState.currentTurn = 'user2';
            return strategy.handleGuess(state, 'user2', { isCorrect: false, guessName: 'cap', matchedPlayer: { name: 'a' } });
        }
    ]);
    await simulateMatch(['STRIKES', 'STRIKES', 'STRIKES'], 'Classic Strikes BO3', [
        (state, strategy) => {
            state.modeState.strikes['user1'] = 2;
            state.modeState.currentTurn = 'user1';
            return strategy.handleGuess(state, 'user1', { isCorrect: false, guessName: 'w3', matchedPlayer: { name: 'a' } });
        },
        (state, strategy) => {
            state.modeState.strikes['user1'] = 2;
            state.modeState.currentTurn = 'user1';
            return strategy.handleGuess(state, 'user1', { isCorrect: false, guessName: 'w3', matchedPlayer: { name: 'a' } });
        }
    ]);
}
run().catch(console.error);
//# sourceMappingURL=verify-combined.js.map