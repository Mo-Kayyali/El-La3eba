"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const top10_mode_strategy_1 = require("../src/game/top10-mode.strategy");
function dumpState(label, state) {
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify({
        status: state.status,
        winner: state.winner,
        scores: state.modeState.scores,
        overallScores: state.modeState.overallScores,
        wrongGuesses: state.modeState.wrongGuesses,
        currentTurn: state.modeState.currentTurn,
        claimedRanks: state.modeState.claimedRanks,
    }, null, 2));
}
async function run() {
    const strategy = new top10_mode_strategy_1.Top10ModeStrategy();
    const state = {
        players: ['u1', 'u2'],
        status: 'in_progress',
        winner: null,
        mode: 'TOP_10',
        modeState: {
            currentTurn: 'u1',
            wrongGuesses: { u1: 0, u2: 0 },
            scores: { u1: 0, u2: 0 },
            claimedRanks: [],
            guessedPlayers: [],
        }
    };
    dumpState('INITIAL STATE', state);
    console.log('\n--- Correct guesses at various ranks ---');
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P1' }, guessName: 'P1', answerDetails: { rank: 1 } });
    dumpState('AFTER U1 GUESS RANK 1', state);
    strategy.handleGuess(state, 'u2', { isCorrect: true, matchedPlayer: { name: 'P6' }, guessName: 'P6', answerDetails: { rank: 6 } });
    dumpState('AFTER U2 GUESS RANK 6', state);
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P10' }, guessName: 'P10', answerDetails: { rank: 10 } });
    dumpState('AFTER U1 GUESS RANK 10', state);
    console.log('\n--- Guessing trap ranks (11, 12, 13) ---');
    strategy.handleGuess(state, 'u2', { isCorrect: true, matchedPlayer: { name: 'P11' }, guessName: 'P11', answerDetails: { rank: 11 } });
    dumpState('AFTER U2 GUESS RANK 11 (-3 pts)', state);
    strategy.handleGuess(state, 'u1', { isCorrect: true, matchedPlayer: { name: 'P12' }, guessName: 'P12', answerDetails: { rank: 12 } });
    dumpState('AFTER U1 GUESS RANK 12 (-2 pts)', state);
    strategy.handleGuess(state, 'u2', { isCorrect: true, matchedPlayer: { name: 'P13' }, guessName: 'P13', answerDetails: { rank: 13 } });
    dumpState('AFTER U2 GUESS RANK 13 (-1 pt)', state);
    console.log('\n--- Guess matching none ---');
    strategy.handleGuess(state, 'u1', { isCorrect: false, matchedPlayer: null, guessName: 'WrongPlayer' });
    dumpState('AFTER U1 WRONG GUESS', state);
    console.log('\n--- Guessing already-claimed rank ---');
    const out = strategy.handleGuess(state, 'u2', { isCorrect: true, matchedPlayer: { name: 'P1' }, guessName: 'P1', answerDetails: { rank: 1 } });
    console.log('Returned error:', out.error);
    dumpState('AFTER U2 DUPLICATE GUESS (should be unchanged)', state);
    console.log('\n--- Turn skipping once one player hits 3 wrong guesses ---');
    strategy.handleTurnTimeout(state, 'u2');
    strategy.handleTurnTimeout(state, 'u1');
    strategy.handleTurnTimeout(state, 'u2');
    strategy.handleTurnTimeout(state, 'u1');
    dumpState('AFTER U1 HITS WRONG=3', state);
    strategy.handleGuess(state, 'u2', { isCorrect: true, matchedPlayer: { name: 'P2' }, guessName: 'P2', answerDetails: { rank: 2 } });
    dumpState('AFTER U2 GUESS (u1 is capped, turn should stay with u2)', state);
    console.log('\n--- Both hit cap (Match End) ---');
    strategy.handleTurnTimeout(state, 'u2');
    dumpState('AFTER U2 HITS WRONG=3 (Match Over)', state);
}
run().catch(console.error);
//# sourceMappingURL=verify-top10.js.map