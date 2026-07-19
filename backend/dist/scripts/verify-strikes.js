"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const strikes_mode_strategy_1 = require("../src/game/strikes-mode.strategy");
function dumpState(label, state) {
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify({
        status: state.status,
        winner: state.winner,
        currentRound: state.modeState.currentRound,
        roundWinnerId: state.modeState.roundWinnerId,
        scores: state.modeState.scores,
        overallScores: state.modeState.overallScores,
        strikes: state.modeState.strikes,
    }, null, 2));
}
async function run() {
    const strategy = new strikes_mode_strategy_1.StrikesModeStrategy();
    const state = {
        players: ['u1', 'u2'],
        status: 'in_progress',
        winner: null,
        mode: 'STRIKES',
        modeState: {
            currentTurn: 'u1',
            currentRound: 1,
            roundWinnerId: null,
            scores: { u1: 0, u2: 0 },
            overallScores: { u1: 0, u2: 0 },
            strikes: { u1: 0, u2: 0 },
            guessedPlayers: [],
            usedQuestionIds: [],
        }
    };
    dumpState('INITIAL STATE', state);
    console.log('\n--- Round 1 ---');
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P1' }, guessName: 'P1' });
    dumpState('U1 Correct (+1 score)', state);
    strategy.handleGuess(state, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'Wrong' });
    dumpState('U2 Wrong (1 Strike)', state);
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P2' }, guessName: 'P2' });
    dumpState('U1 Correct (+1 score)', state);
    strategy.handleGuess(state, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'Wrong2' });
    dumpState('U2 Wrong (2 Strikes)', state);
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P3' }, guessName: 'P3' });
    dumpState('U1 Correct (+1 score)', state);
    strategy.handleGuess(state, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'Wrong3' });
    dumpState('U2 Wrong (3 Strikes - U1 Wins Round)', state);
    console.log('\n--- Round 2 ---');
    state.modeState.currentRound = 2;
    strategy.setupNextRound(state);
    dumpState('AFTER SETUP NEXT ROUND', state);
    strategy.handleTurnTimeout(state, 'u1');
    strategy.handleGuess(state, 'u2', { isCorrect: true, matchedPlayer: { name: 'P4' }, guessName: 'P4' });
    strategy.handleTurnTimeout(state, 'u1');
    strategy.handleGuess(state, 'u2', { isCorrect: true, matchedPlayer: { name: 'P5' }, guessName: 'P5' });
    strategy.handleTurnTimeout(state, 'u1');
    dumpState('U1 3 TIMEOUTS (U2 Wins Round)', state);
    console.log('\n--- Round 3 (Match Decider) ---');
    state.modeState.currentRound = 3;
    strategy.setupNextRound(state);
    dumpState('AFTER SETUP NEXT ROUND', state);
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P6' }, guessName: 'P6' });
    strategy.handleGuess(state, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'W' });
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P7' }, guessName: 'P7' });
    strategy.handleGuess(state, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'W' });
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P8' }, guessName: 'P8' });
    const res = strategy.handleGuess(state, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'W' });
    console.log('Result flags:', res);
    dumpState('U2 3 STRIKES (U1 Wins Match)', state);
}
run().catch(console.error);
//# sourceMappingURL=verify-strikes.js.map