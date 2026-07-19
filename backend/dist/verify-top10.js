"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const top10_mode_strategy_1 = require("./src/game/top10-mode.strategy");
const elo_util_1 = require("./src/game/elo.util");
async function main() {
    const strategy = new top10_mode_strategy_1.Top10ModeStrategy();
    console.log('=== STEP 0: Top 10 tie-break rule ===');
    function makeState() {
        return {
            players: ['user1', 'user2'],
            status: 'in_progress',
            winner: null,
            modeState: {
                currentTurn: 'user1',
                scores: { user1: 0, user2: 0 },
                wrongGuesses: { user1: 0, user2: 0 },
                claimedRanks: [],
                guessedPlayers: []
            }
        };
    }
    let stateA = makeState();
    stateA.modeState.scores = { user1: 5, user2: 5 };
    stateA.modeState.wrongGuesses = { user1: 3, user2: 3 };
    console.log('(a) Both capped tie win condition:', JSON.stringify(strategy.checkMatchWinCondition(stateA)));
    let stateB = makeState();
    stateB.modeState.scores = { user1: 27, user2: 27 };
    stateB.modeState.wrongGuesses = { user1: 1, user2: 2 };
    stateB.modeState.claimedRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    console.log('(b) All 10 claimed tie win condition:', JSON.stringify(strategy.checkMatchWinCondition(stateB)));
    let stateC = makeState();
    stateC.modeState.scores = { user1: 28, user2: 27 };
    stateC.modeState.wrongGuesses = { user1: 1, user2: 2 };
    stateC.modeState.claimedRanks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    console.log('(c) Normal win condition:', JSON.stringify(strategy.checkMatchWinCondition(stateC)));
    console.log('\n=== STEP 0.5: Proper Elo draw MMR calculation ===');
    const mmrA = 1000;
    const mmrB = 1200;
    console.log(`Test draw between ${mmrA} and ${mmrB}`);
    const resultDraw = (0, elo_util_1.calculateEloDraw)(mmrA, mmrB);
    console.log('Result:', resultDraw);
}
main().catch(console.error);
//# sourceMappingURL=verify-top10.js.map