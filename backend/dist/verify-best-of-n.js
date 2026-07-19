"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strikes_mode_strategy_1 = require("./src/game/strikes-mode.strategy");
const top10_mode_strategy_1 = require("./src/game/top10-mode.strategy");
const matchmaking_service_1 = require("./src/game/matchmaking.service");
const elo_util_1 = require("./src/game/elo.util");
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
        console.log(`Round Winner: ${outcome.roundWinner || 'DRAW'}`);
        console.log(`Overall Scores -> user1: ${state.modeState.overallScores['user1']}, user2: ${state.modeState.overallScores['user2']}`);
        console.log(`Match Over: ${outcome.isMatchOver}`);
        if (outcome.isMatchOver) {
            console.log(`Match Winner: ${state.winner || 'DRAW'}`);
            if (state.winner === null) {
                console.log(`MMR Delta (Draw):`, (0, elo_util_1.calculateEloDraw)(1000, 1200));
            }
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
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: false, guessName: 'wrong1' });
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: true, guessName: 'right', matchedPlayer: { name: 'a' } });
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: false, guessName: 'wrong2' });
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: true, guessName: 'right', matchedPlayer: { name: 'a' } });
            return strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: false, guessName: 'wrong3' });
        },
        (state, strategy) => {
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: false, guessName: 'wrong1' });
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: true, guessName: 'right', matchedPlayer: { name: 'a' } });
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: false, guessName: 'wrong2' });
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: true, guessName: 'right', matchedPlayer: { name: 'a' } });
            return strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: false, guessName: 'wrong3' });
        },
        (state, strategy) => {
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: true, answerDetails: { rank: 1 }, matchedPlayer: { name: 'a' } });
            strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: true, answerDetails: { rank: 2 }, matchedPlayer: { name: 'a' } });
            state.modeState.wrongGuesses['user1'] = 3;
            state.modeState.wrongGuesses['user2'] = 3;
            state.modeState.scores['user1'] = 5;
            state.modeState.scores['user2'] = 5;
            return strategy.handleGuess(state, state.modeState.currentTurn, { isCorrect: false, guessName: 'cap_hit' });
        }
    ]);
    await simulateMatch(['STRIKES', 'STRIKES', 'STRIKES'], 'Classic Strikes BO3', [
        (state, strategy) => {
            state.modeState.strikes['user1'] = 2;
            state.modeState.currentTurn = 'user1';
            return strategy.handleGuess(state, 'user1', { isCorrect: false, guessName: 'wrong3', matchedPlayer: { name: 'a' } });
        },
        (state, strategy) => {
            state.modeState.strikes['user1'] = 2;
            state.modeState.currentTurn = 'user1';
            return strategy.handleGuess(state, 'user1', { isCorrect: false, guessName: 'wrong3', matchedPlayer: { name: 'a' } });
        }
    ]);
}
run().catch(console.error);
//# sourceMappingURL=verify-best-of-n.js.map