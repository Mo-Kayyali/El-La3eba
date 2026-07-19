"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const top10_mode_strategy_1 = require("../src/game/top10-mode.strategy");
function dumpState(label, state) {
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify({
        status: state.status,
        winner: state.winner,
        scores: state.modeState.scores,
        wrongGuesses: state.modeState.wrongGuesses,
        currentTurn: state.modeState.currentTurn,
        claimedRanks: state.modeState.claimedRanks,
    }, null, 2));
}
async function run() {
    const strategy = new top10_mode_strategy_1.Top10ModeStrategy();
    console.log('#################################################################');
    console.log('# PART 1: GENUINE DRAW BUG CHECK (Capping via Guesses Only)     #');
    console.log('#################################################################');
    const state1 = {
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
    strategy.handleGuess(state1, 'u1', { isCorrect: false, matchedPlayer: null, guessName: 'w1' });
    strategy.handleGuess(state1, 'u2', { isCorrect: true, matchedPlayer: { name: 'p1' }, guessName: 'p1', answerDetails: { rank: 1 } });
    strategy.handleGuess(state1, 'u1', { isCorrect: false, matchedPlayer: null, guessName: 'w2' });
    strategy.handleGuess(state1, 'u2', { isCorrect: true, matchedPlayer: { name: 'p2' }, guessName: 'p2', answerDetails: { rank: 2 } });
    strategy.handleGuess(state1, 'u1', { isCorrect: false, matchedPlayer: null, guessName: 'w3' });
    strategy.handleGuess(state1, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'w4' });
    strategy.handleGuess(state1, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'w5' });
    dumpState('STATE BEFORE U2 FINAL WRONG GUESS (u1=3 wrong, u2=2 wrong)', state1);
    strategy.handleGuess(state1, 'u2', { isCorrect: false, matchedPlayer: null, guessName: 'w6' });
    dumpState('STATE AFTER U2 FINAL WRONG GUESS (Both hit 3, should be match_completed)', state1);
    console.log('\n\n#################################################################');
    console.log('# PART 2: REAL END-TO-END TIE-BREAK MATCH (All 10 Ranks Claimed)#');
    console.log('#################################################################');
    console.log('Note: The 50-50 tie test previously shown was directly mocked to isolate the tie-break function.');
    console.log('This test will run a fully authentic end-to-end match via handleGuess achieving a tie-break.');
    const state2 = {
        players: ['p1', 'p2'],
        status: 'in_progress',
        winner: null,
        mode: 'TOP_10',
        modeState: {
            currentTurn: 'p1',
            wrongGuesses: { p1: 0, p2: 0 },
            scores: { p1: 0, p2: 0 },
            claimedRanks: [],
            guessedPlayers: [],
        }
    };
    strategy.handleGuess(state2, 'p1', { isCorrect: true, matchedPlayer: { name: 'a' }, guessName: 'a', answerDetails: { rank: 10 } });
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'b' }, guessName: 'b', answerDetails: { rank: 7 } });
    strategy.handleGuess(state2, 'p1', { isCorrect: true, matchedPlayer: { name: 'c' }, guessName: 'c', answerDetails: { rank: 9 } });
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'd' }, guessName: 'd', answerDetails: { rank: 6 } });
    strategy.handleGuess(state2, 'p1', { isCorrect: true, matchedPlayer: { name: 'e' }, guessName: 'e', answerDetails: { rank: 8 } });
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'f' }, guessName: 'f', answerDetails: { rank: 5 } });
    strategy.handleGuess(state2, 'p1', { isCorrect: false, matchedPlayer: null, guessName: 'w1' });
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'g' }, guessName: 'g', answerDetails: { rank: 4 } });
    strategy.handleGuess(state2, 'p1', { isCorrect: false, matchedPlayer: null, guessName: 'w2' });
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'h' }, guessName: 'h', answerDetails: { rank: 3 } });
    strategy.handleGuess(state2, 'p1', { isCorrect: false, matchedPlayer: null, guessName: 'w3' });
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'i' }, guessName: 'i', answerDetails: { rank: 13 } });
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'j' }, guessName: 'j', answerDetails: { rank: 2 } });
    dumpState('STATE BEFORE FINAL RANK (Scores: p1=27, p2=26. p1 wrong=3, p2 wrong=0)', state2);
    strategy.handleGuess(state2, 'p2', { isCorrect: true, matchedPlayer: { name: 'k' }, guessName: 'k', answerDetails: { rank: 1 } });
    dumpState('STATE AFTER FINAL RANK CLAIMED (Match over, Tie-Break executed, p2 wins due to fewer wrong guesses)', state2);
}
run().catch(console.error);
//# sourceMappingURL=verify-top10-clarifications.js.map