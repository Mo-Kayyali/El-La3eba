"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const matchmaking_service_1 = require("./src/game/matchmaking.service");
const redis_service_1 = require("./src/redis/redis.service");
const game_gateway_1 = require("./src/game/game.gateway");
const game_service_1 = require("./src/game/game.service");
class MockNonTurnBasedStrategy {
    handleGuess(state, userId, guessResult) {
        if (guessResult.isCorrect) {
            state.modeState.scores[userId] += 1;
            state.modeState.guessedPlayers.push({ name: guessResult.guessName, guessedBy: userId });
            return {
                updatedState: state,
                isRoundOver: true,
                roundWinner: userId,
            };
        }
        return { updatedState: state };
    }
    handleTurnTimeout(state, userId) { return { updatedState: state }; }
    checkMatchWinCondition(state) { return null; }
    handleDisconnectTimeout(state, disconnectedUserId) { return { updatedState: state, isMatchOver: true, winnerId: 'p1' }; }
    handleForfeit(state, forfeitingUserId) { return { updatedState: state, winnerId: 'p1' }; }
    getOpponent(state, userId) { return state.players.find((p) => p !== userId) || state.players[0]; }
    setupNextRound(state) { }
}
async function verifyConcurrent() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const matchmaking = app.get(matchmaking_service_1.MatchmakingService);
    const redis = app.get(redis_service_1.RedisService);
    const gateway = app.get(game_gateway_1.GameGateway);
    const p1 = 'user-1';
    const p2 = 'user-2';
    const gameSessionId = 'test-session-concurrent';
    const key = `game:${gameSessionId}`;
    console.log('--- Initializing Non-Turn-Based Match ---');
    await matchmaking['initializeGameState'](gameSessionId, p1, p2, 'p1', 'p2', false);
    const strategy = new MockNonTurnBasedStrategy();
    gateway.strategy = strategy;
    const gameService = app.get(game_service_1.GameService);
    gameService.guessPlayer = async () => [{ id: 'player-1', name: 'Test Player', isAmbiguous: false }];
    let isFirst = true;
    gameService.validateAnswer = async () => {
        if (isFirst) {
            isFirst = false;
            await new Promise(r => setTimeout(r, 10));
        }
        else {
            await new Promise(r => setTimeout(r, 100));
        }
        return true;
    };
    console.log('--- Firing simultaneous guesses ---');
    const mockClient1 = { id: 'socket1', data: { user: { sub: p1 } }, emit: () => { } };
    const mockClient2 = { id: 'socket2', data: { user: { sub: p2 } }, emit: () => { } };
    let snapshotState = null;
    gateway.server = {
        to: (room) => {
            return {
                emit: async (ev, payload) => {
                    if (ev === 'roundOver' && !snapshotState) {
                        const str = await redis.get(key);
                        snapshotState = JSON.parse(str);
                        console.log('\n--- SNAPSHOT AT roundOver EMIT ---');
                        console.log('Scores:', snapshotState.modeState.scores);
                        console.log('roundWinnerId:', snapshotState.modeState.roundWinnerId);
                        console.log('guessedPlayers:', snapshotState.modeState.guessedPlayers);
                        console.log('----------------------------------\n');
                    }
                }
            };
        }
    };
    const [res1, res2] = await Promise.all([
        gateway.handleSubmitGuess(mockClient1, { gameSessionId, guessName: 'Test Player' }),
        gateway.handleSubmitGuess(mockClient2, { gameSessionId, guessName: 'Test Player' })
    ]);
    console.log('P1 result:', res1);
    console.log('P2 result:', res2);
    await app.close();
    process.exit(0);
}
verifyConcurrent();
//# sourceMappingURL=verify-stage3-concurrent.js.map