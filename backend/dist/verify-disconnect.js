"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const game_gateway_1 = require("./src/game/game.gateway");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const gameGateway = app.get(game_gateway_1.GameGateway);
    const redis = gameGateway.redisClient;
    const p1 = 'user-1';
    const p2 = 'user-2';
    const gameSessionId = 'test-disconnect';
    const initialState = {
        players: [p1, p2],
        status: 'in_progress',
        isRanked: true,
        currentRound: 1,
        scores: { [p1]: 0, [p2]: 0 },
        strikes: { [p1]: 0, [p2]: 0 },
        overallScores: { [p1]: 0, [p2]: 0 },
        currentTurn: p1,
        turnDeadlineAt: Date.now() + 10000,
        currentQuestion: { id: 'q1', targetPosition: 'ST', clubs: [], attributes: [] },
        guessedPlayers: [],
        roundHistory: [],
        usedQuestionIds: [],
        roundWinnerId: null,
    };
    await redis.set(`game:${gameSessionId}`, JSON.stringify(initialState));
    gameGateway.server = {
        to: (room) => ({ emit: () => { } }),
    };
    console.log('--- Initial State ---');
    const initStr = await redis.get(`game:${gameSessionId}`);
    let s = JSON.parse(initStr || '{}');
    console.log(`[INIT] status: ${s.status}, winner: ${s.winner || 'None'}`);
    console.log('\n--- P1 Disconnects (Forfeit) ---');
    await gameGateway.startDisconnectTimer(gameSessionId, p1);
    const key = gameGateway.disconnectTimerKey(gameSessionId, p1);
    const timeoutId = gameGateway.disconnectTimers.get(key);
    if (timeoutId) {
        clearTimeout(timeoutId);
        const outcome = gameGateway.strategy.handleDisconnectTimeout(s, p1);
        await redis.set(`game:${gameSessionId}`, JSON.stringify(outcome.updatedState));
    }
    const finalStr = await redis.get(`game:${gameSessionId}`);
    s = JSON.parse(finalStr || '{}');
    console.log(`[AFTER FORFEIT] status: ${s.status}, winner: ${s.winner || 'None'}`);
    await app.close();
    process.exit(0);
}
run();
//# sourceMappingURL=verify-disconnect.js.map