"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strikes_mode_strategy_1 = require("./src/game/strikes-mode.strategy");
const top10_mode_strategy_1 = require("./src/game/top10-mode.strategy");
const matchmaking_service_1 = require("./src/game/matchmaking.service");
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
async function run() {
    const mms = new matchmaking_service_1.MatchmakingService(createMockService().redisClient, createMockService().prisma, createMockService().gameService);
    mms.setActiveGameSessionIdInMulti = () => { };
    const state = await mms.initializeGameState('session1', 'user1', 'user2', 'User One', 'User Two', true, ['STRIKES', 'STRIKES', 'TOP_10']);
    const strategy1 = resolveStrategy(state.mode);
    state.modeState.strikes['user1'] = 2;
    state.modeState.currentTurn = 'user1';
    strategy1.handleGuess(state, 'user1', { isCorrect: false, guessName: 'wrong3', matchedPlayer: { name: 'a' } });
    state.modeState.currentRound += 1;
    state.modeState.roundWinnerId = null;
    state.mode = state.composition[state.modeState.currentRound - 1];
    resolveStrategy(state.mode).initializeRoundState(state);
    const strategy2 = resolveStrategy(state.mode);
    state.modeState.strikes['user2'] = 2;
    state.modeState.currentTurn = 'user2';
    strategy2.handleGuess(state, 'user2', { isCorrect: false, guessName: 'wrong3', matchedPlayer: { name: 'a' } });
    state.modeState.currentRound += 1;
    state.modeState.roundWinnerId = null;
    state.mode = state.composition[state.modeState.currentRound - 1];
    resolveStrategy(state.mode).initializeRoundState(state);
    const strategy3 = resolveStrategy(state.mode);
    console.log('--- Round 3 (TOP_10) ---');
    state.modeState.currentTurn = 'user1';
    strategy3.handleGuess(state, 'user1', { isCorrect: true, answerDetails: { rank: 5 }, matchedPlayer: { name: 'a' } });
    state.modeState.currentTurn = 'user1';
    strategy3.handleGuess(state, 'user1', { isCorrect: true, answerDetails: { rank: 7 }, matchedPlayer: { name: 'a' } });
    state.modeState.currentTurn = 'user2';
    strategy3.handleGuess(state, 'user2', { isCorrect: true, answerDetails: { rank: 2 }, matchedPlayer: { name: 'a' } });
    state.modeState.currentTurn = 'user2';
    strategy3.handleGuess(state, 'user2', { isCorrect: true, answerDetails: { rank: 10 }, matchedPlayer: { name: 'a' } });
    state.modeState.wrongGuesses['user1'] = 3;
    state.modeState.wrongGuesses['user2'] = 2;
    state.modeState.currentTurn = 'user2';
    const outcome = strategy3.handleGuess(state, 'user2', { isCorrect: false, guessName: 'cap_hit', matchedPlayer: { name: 'a' } });
    console.log(`Scores -> user1: ${state.modeState.scores['user1']}, user2: ${state.modeState.scores['user2']}`);
    console.log(`Round Winner: ${outcome.roundWinner || 'DRAW'}`);
    console.log(`Overall Scores -> user1: ${state.modeState.overallScores['user1']}, user2: ${state.modeState.overallScores['user2']}`);
    console.log(`Match Over: ${outcome.isMatchOver}`);
    console.log(`Match Winner: ${state.winner || 'DRAW'}`);
}
run().catch(console.error);
//# sourceMappingURL=verify-tie.js.map