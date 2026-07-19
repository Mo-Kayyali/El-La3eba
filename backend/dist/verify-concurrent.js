"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const game_gateway_1 = require("./src/game/game.gateway");
const game_service_1 = require("./src/game/game.service");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const gameGateway = app.get(game_gateway_1.GameGateway);
    const gameService = app.get(game_service_1.GameService);
    const redis = gameGateway.redisClient;
    const p1 = 'user-1';
    const p2 = 'user-2';
    const gameSessionId = 'test-concurrent-2';
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
    const mockSocketP1 = { id: 's1', data: { user: { userId: p1 } }, emit: () => { } };
    const mockSocketP2 = { id: 's2', data: { user: { userId: p2 } }, emit: () => { } };
    gameGateway.strategy = {
        handleGuess: (state, userId, guessResult) => {
            state.scores[userId] += 1;
            state.guessedPlayers.push({ name: guessResult.matchedPlayer.name, guessText: guessResult.guessName, guessedBy: userId, isCorrect: true, playerId: guessResult.matchedPlayer.id });
            return {
                updatedState: state,
                isRoundOver: true,
                isMatchOver: false,
                roundWinner: userId
            };
        }
    };
    gameService.guessPlayer = async (guess) => {
        return [{
                id: 'player-1',
                name: guess === 'Test' ? 'Tanner Tessmann' : 'Wrong Player',
                isAmbiguous: false,
            }];
    };
    gameService.validateAnswer = async (q, p) => {
        await new Promise(res => setTimeout(res, 50));
        return p.name === 'Tanner Tessmann';
    };
    console.log('STATE BEFORE:');
    const stateStrBefore = await redis.get(`game:${gameSessionId}`);
    console.log(stateStrBefore);
    console.log('--- Submitting guesses simultaneously ---');
    const [res1, res2] = await Promise.all([
        gameGateway.handleSubmitGuess(mockSocketP1, { gameSessionId, guessName: 'Test' }),
        gameGateway.handleSubmitGuess(mockSocketP2, { gameSessionId, guessName: 'Test' })
    ]);
    console.log('[P1 RESULT]:', JSON.stringify(res1));
    console.log('[P2 RESULT]:', JSON.stringify(res2));
    console.log('STATE AFTER:');
    const stateStrAfter = await redis.get(`game:${gameSessionId}`);
    console.log(stateStrAfter);
    await app.close();
    process.exit(0);
}
run();
//# sourceMappingURL=verify-concurrent.js.map