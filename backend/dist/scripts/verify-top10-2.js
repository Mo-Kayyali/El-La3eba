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
    const state2 = {
        players: ['u1', 'u2'],
        status: 'in_progress',
        winner: null,
        mode: 'TOP_10',
        modeState: {
            currentTurn: 'u1',
            wrongGuesses: { u1: 2, u2: 1 },
            scores: { u1: 5, u2: 5 },
            claimedRanks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
            guessedPlayers: [],
        }
    };
    console.log('\n--- Match ending when all 10 real ranks are claimed (Tie Break) ---');
    dumpState('BEFORE LAST RANK CLAIMED', state2);
    strategy.handleGuess(state2, 'u1', { isCorrect: true, matchedPlayer: {}, guessName: 'P11', answerDetails: { rank: 11 } });
    const tieState = {
        players: ['u1', 'u2'],
        status: 'in_progress',
        winner: null,
        mode: 'TOP_10',
        modeState: {
            currentTurn: 'u1',
            wrongGuesses: { u1: 2, u2: 1 },
            scores: { u1: 50, u2: 50 },
            claimedRanks: [1, 2, 3, 4, 5, 6, 7, 8, 9],
            guessedPlayers: [],
        }
    };
    tieState.modeState.scores.u1 = 40;
    tieState.modeState.scores.u2 = 50;
    strategy.handleGuess(tieState, 'u1', { isCorrect: true, matchedPlayer: {}, guessName: 'P10', answerDetails: { rank: 10 } });
    dumpState('AFTER U1 CLAIMS LAST RANK (Scores tied 50-50, u2 has fewer wrong guesses: 1 vs 2)', tieState);
    const drawState = {
        players: ['u1', 'u2'],
        status: 'in_progress',
        winner: null,
        mode: 'TOP_10',
        modeState: {
            currentTurn: 'u1',
            wrongGuesses: { u1: 3, u2: 2 },
            scores: { u1: 10, u2: 10 },
            claimedRanks: [],
            guessedPlayers: [],
        }
    };
    console.log('\n--- Genuine Draw Scenario ---');
    strategy.handleTurnTimeout(drawState, 'u2');
    dumpState('AFTER U2 TIMEOUT (Scores tied, Wrong Guesses tied 3-3)', drawState);
    const dcState = {
        players: ['u1', 'u2'],
        status: 'in_progress',
        winner: null,
        mode: 'TOP_10',
        modeState: {}
    };
    console.log('\n--- Disconnect Win ---');
    strategy.handleDisconnectTimeout(dcState, 'u1');
    dumpState('AFTER U1 DISCONNECT', dcState);
}
run().catch(console.error);
//# sourceMappingURL=verify-top10-2.js.map