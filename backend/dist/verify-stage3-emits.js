"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const matchmaking_service_1 = require("./src/game/matchmaking.service");
const game_gateway_1 = require("./src/game/game.gateway");
async function verifyEmitPayloads() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const matchmaking = app.get(matchmaking_service_1.MatchmakingService);
    const gateway = app.get(game_gateway_1.GameGateway);
    const p1 = 'user-1';
    const p2 = 'user-2';
    const gameSessionId = 'test-session-emits-fix';
    let capturedGameStateUpdated = null;
    let capturedMatchOver = null;
    gateway.server = {
        to: (room) => {
            if (room === gameSessionId) {
                return {
                    emit: (event, payload) => {
                        if (event === 'gameStateUpdated') {
                            capturedGameStateUpdated = payload;
                        }
                        else if (event === 'matchOver') {
                            capturedMatchOver = payload;
                        }
                    }
                };
            }
            return { emit: () => { } };
        }
    };
    console.log('--- Initializing Match ---');
    await matchmaking['initializeGameState'](gameSessionId, p1, p2, 'p1', 'p2', false);
    const mockClient = { id: 'socket1', data: { user: { sub: p1 } }, emit: () => { } };
    await gateway.handleSubmitGuess(mockClient, { gameSessionId, guessName: 'Wrong Name' });
    console.log('\n--- CAPTURED gameStateUpdated PAYLOAD ---');
    console.log(JSON.stringify(capturedGameStateUpdated, null, 2));
    if ('modeState' in capturedGameStateUpdated.state) {
        console.error('ERROR: modeState is still present in gameStateUpdated payload!');
    }
    else {
        console.log('SUCCESS: modeState key successfully stripped from gameStateUpdated payload.');
    }
    await gateway.handleForfeitMatch(mockClient, gameSessionId);
    console.log('\n--- CAPTURED matchOver PAYLOAD ---');
    console.log(JSON.stringify(capturedMatchOver, null, 2));
    if ('modeState' in capturedMatchOver.state) {
        console.error('ERROR: modeState is still present in matchOver payload!');
    }
    else {
        console.log('SUCCESS: modeState key successfully stripped from matchOver payload.');
    }
    await app.close();
    process.exit(0);
}
verifyEmitPayloads();
//# sourceMappingURL=verify-stage3-emits.js.map