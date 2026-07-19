"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const matchmaking_service_1 = require("./src/game/matchmaking.service");
const redis_service_1 = require("./src/redis/redis.service");
const game_gateway_1 = require("./src/game/game.gateway");
const strikes_mode_strategy_1 = require("./src/game/strikes-mode.strategy");
async function verifyBo3() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const matchmaking = app.get(matchmaking_service_1.MatchmakingService);
    const redis = app.get(redis_service_1.RedisService);
    const gateway = app.get(game_gateway_1.GameGateway);
    const p1 = 'user-1';
    const p2 = 'user-2';
    const gameSessionId = 'test-session-bo3';
    const key = `game:${gameSessionId}`;
    console.log('--- Initializing BO3 Match ---');
    await matchmaking['initializeGameState'](gameSessionId, p1, p2, 'p1', 'p2', false);
    let stateStr = await redis.get(key);
    let state = JSON.parse(stateStr);
    console.log('Initial modeState:', JSON.stringify(state.modeState, null, 2));
    const strategy = new strikes_mode_strategy_1.StrikesModeStrategy();
    gateway.strategy = strategy;
    const simulateTimeout = async (userId) => {
        stateStr = await redis.get(key);
        state = JSON.parse(stateStr);
        const outcome = strategy.handleTurnTimeout(state, userId);
        if (outcome.isRoundOver && outcome.roundWinner) {
            state.modeState.roundWinnerId = outcome.roundWinner;
            if (!Array.isArray(state.modeState.roundHistory))
                state.modeState.roundHistory = [];
            if (!state.modeState.roundHistory.some((r) => r?.round === state.modeState.currentRound)) {
                state.modeState.roundHistory.push({
                    round: state.modeState.currentRound,
                    winner: outcome.roundWinner,
                    scores: { ...(state.modeState.scores ?? {}) },
                });
            }
        }
        if (outcome.isMatchOver) {
            await redis.del(key);
            state.status = 'match_completed';
            console.log(`[AFTER TIMEOUT ${userId}] MATCH OVER. Winner:`, state.winner);
        }
        else {
            await redis.set(key, JSON.stringify(state));
            console.log(`[AFTER TIMEOUT ${userId}] Round over? ${outcome.isRoundOver}, overallScores:`, state.modeState.overallScores);
        }
        if (outcome.isRoundOver && !outcome.isMatchOver) {
            state.modeState.currentRound += 1;
            state.modeState.roundWinnerId = null;
            state.modeState.scores = { [p1]: 0, [p2]: 0 };
            strategy.setupNextRound(state);
            state.modeState.guessedPlayers = [];
            await redis.set(key, JSON.stringify(state));
            console.log(`[NEXT ROUND STARTED] currentRound:`, state.modeState.currentRound, 'strikes:', state.modeState.strikes);
        }
    };
    console.log('\n--- Round 1: P1 wins by P2 timing out 3 times ---');
    await simulateTimeout(p2);
    await simulateTimeout(p2);
    await simulateTimeout(p2);
    console.log('\n--- Round 2: P2 wins by P1 timing out 3 times ---');
    await simulateTimeout(p1);
    await simulateTimeout(p1);
    await simulateTimeout(p1);
    console.log('\n--- Round 3: P1 wins by P2 timing out 3 times (MATCH OVER) ---');
    await simulateTimeout(p2);
    await simulateTimeout(p2);
    await simulateTimeout(p2);
    const finalState = state;
    console.log('\n--- FINAL STATUS ---');
    console.log('Status:', finalState.status);
    console.log('Winner:', finalState.winner);
    console.log('Final modeState.roundHistory:', JSON.stringify(finalState.modeState?.roundHistory ?? finalState.roundHistory, null, 2));
    console.log('Final modeState.overallScores:', JSON.stringify(finalState.modeState?.overallScores ?? finalState.overallScores, null, 2));
    await app.close();
    process.exit(0);
}
verifyBo3();
//# sourceMappingURL=verify-stage3-bo3.js.map