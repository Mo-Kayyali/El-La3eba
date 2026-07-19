import { Top10ModeStrategy } from './src/game/top10-mode.strategy';
import { calculateEloDraw, calculateElo } from './src/game/elo.util';

async function main() {
  const strategy = new Top10ModeStrategy();
  
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

  // (a) genuine score tie via both capped
  let stateA = makeState();
  stateA.modeState.scores = { user1: 5, user2: 5 };
  stateA.modeState.wrongGuesses = { user1: 3, user2: 3 };
  console.log('(a) Both capped tie win condition:', JSON.stringify(strategy.checkMatchWinCondition(stateA)));

  // (b) genuine score tie via all 10 claimed
  let stateB = makeState();
  stateB.modeState.scores = { user1: 27, user2: 27 };
  stateB.modeState.wrongGuesses = { user1: 1, user2: 2 }; // different wrong guesses to prove tiebreak removed
  stateB.modeState.claimedRanks = [1,2,3,4,5,6,7,8,9,10];
  console.log('(b) All 10 claimed tie win condition:', JSON.stringify(strategy.checkMatchWinCondition(stateB)));

  // (c) normal non-tied win
  let stateC = makeState();
  stateC.modeState.scores = { user1: 28, user2: 27 };
  stateC.modeState.wrongGuesses = { user1: 1, user2: 2 };
  stateC.modeState.claimedRanks = [1,2,3,4,5,6,7,8,9,10];
  console.log('(c) Normal win condition:', JSON.stringify(strategy.checkMatchWinCondition(stateC)));

  console.log('\n=== STEP 0.5: Proper Elo draw MMR calculation ===');
  
  const mmrA = 1000;
  const mmrB = 1200;
  console.log(`Test draw between ${mmrA} and ${mmrB}`);
  const resultDraw = calculateEloDraw(mmrA, mmrB);
  console.log('Result:', resultDraw);

  // For verification: hand calc:
  // E_A = 1 / (1 + 10^((1200 - 1000) / 400)) = 1 / (1 + 10^(0.5)) = 1 / (1 + 3.16227) = 1 / 4.16227 = 0.24025
  // E_B = 1 - 0.24025 = 0.75975
  // deltaA = 32 * (0.5 - 0.24025) = 32 * 0.25975 = 8.312 -> 8
  // deltaB = 32 * (0.5 - 0.75975) = 32 * -0.25975 = -8.312 -> -8
  // Hand calculated values: deltaA = 8, deltaB = -8
}

main().catch(console.error);
