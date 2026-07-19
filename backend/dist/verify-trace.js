"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const game_gateway_1 = require("./src/game/game.gateway");
const game_service_1 = require("./src/game/game.service");
const strikes_mode_strategy_1 = require("./src/game/strikes-mode.strategy");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const gameGateway = app.get(game_gateway_1.GameGateway);
    const gameService = app.get(game_service_1.GameService);
    const redis = gameGateway.redisClient;
    const p1 = 'user-1';
    const p2 = 'user-2';
    const gameSessionId = 'test-trace';
    const key = `game:${gameSessionId}`;
    gameGateway.server = { to: () => ({ emit: () => { } }) };
    gameService.guessPlayer = async (guess) => [{ id: 'p1', name: 'Wrong Player', isAmbiguous: false }];
    gameService.validateAnswer = async () => false;
    gameService.getRandomQuestion = async () => ({ id: 'q2', targetPosition: 'ST', clubs: [], attributes: [] });
    const realStrategy = new strikes_mode_strategy_1.StrikesModeStrategy();
    const instrumentedStrategy = {
        getOpponent: realStrategy.getOpponent.bind(realStrategy),
        handleDisconnectTimeout: realStrategy.handleDisconnectTimeout.bind(realStrategy),
        handleTurnTimeout: (state, userId) => {
            const outcome = realStrategy.handleTurnTimeout(state, userId);
            console.log(`  [STRATEGY handleTurnTimeout] strikes=${JSON.stringify(state.strikes)}, isRoundOver=${outcome.isRoundOver}, isMatchOver=${outcome.isMatchOver}, overallScores=${JSON.stringify(state.overallScores)}, currentRound=${state.currentRound}`);
            return outcome;
        },
        handleGuess: (state, userId, guessResult) => {
            const outcome = realStrategy.handleGuess(state, userId, guessResult);
            if (!outcome.error) {
                console.log(`  [STRATEGY handleGuess] strikes=${JSON.stringify(state.strikes)}, isRoundOver=${outcome.isRoundOver}, isMatchOver=${outcome.isMatchOver}, roundWinner=${outcome.roundWinner}, overallScores=${JSON.stringify(state.overallScores)}, currentRound=${state.currentRound}`);
            }
            return outcome;
        },
        checkMatchWinCondition: (state) => {
            const result = realStrategy.checkMatchWinCondition(state);
            console.log(`  [STRATEGY checkMatchWinCondition] currentRound=${state.currentRound}, overallScores=${JSON.stringify(state.overallScores)}, result=${result}`);
            return result;
        },
        setupNextRound: realStrategy.setupNextRound.bind(realStrategy),
    };
    gameGateway.strategy = instrumentedStrategy;
    const setupRound = async (currentRound, overallScores, turnPlayer) => {
        const state = {
            players: [p1, p2],
            status: 'in_progress',
            isRanked: false,
            currentRound,
            scores: { [p1]: 0, [p2]: 0 },
            strikes: { [p1]: 0, [p2]: 0 },
            overallScores,
            currentTurn: turnPlayer,
            turnDeadlineAt: Date.now() + 10000,
            currentQuestion: { id: 'q1', targetPosition: 'ST', clubs: [], attributes: [] },
            guessedPlayers: [],
            roundHistory: [],
            usedQuestionIds: [],
            roundWinnerId: null,
        };
        await redis.set(key, JSON.stringify(state));
    };
    const submitWrong = async (socket) => {
        return gameGateway.handleSubmitGuess(socket, { gameSessionId, guessName: 'Wrong' });
    };
    const sock1 = { id: 's1', data: { user: { userId: p1 } }, emit: () => { } };
    const sock2 = { id: 's2', data: { user: { userId: p2 } }, emit: () => { } };
    console.log('\n========== ROUND 1 (currentRound=1, overallScores all zeros) ==========');
    console.log('Expect: after P2 gets strike 3, overallScores[user-1] should become 1.');
    await setupRound(1, { [p1]: 0, [p2]: 0 }, p1);
    await submitWrong(sock1);
    let s = JSON.parse((await redis.get(key)));
    console.log(`[After P1 strike 1] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}`);
    await submitWrong(sock2);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P2 strike 1] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}`);
    await submitWrong(sock1);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P1 strike 2] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}`);
    await submitWrong(sock2);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P2 strike 2] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}`);
    console.log('\n--- P2 gets 3rd strike (ROUND 1 ENDS) ---');
    await submitWrong(sock1);
    await submitWrong(sock1);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P1 strike 3 -> ROUND 1 END then next-round setup] overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}, status=${s.status}, winner=${s.winner}`);
    console.log('\n========== ROUND 3 (currentRound=3, overallScores 1-1) ==========');
    console.log('Expect: after 3rd strike, checkMatchWinCondition fires with currentRound=3, status becomes match_completed.');
    await setupRound(3, { [p1]: 1, [p2]: 1 }, p1);
    s = JSON.parse((await redis.get(key)));
    console.log(`[BEFORE Round 3] overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}`);
    await submitWrong(sock1);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P1 strike 1] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}, status=${s.status}`);
    await submitWrong(sock2);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P2 strike 1] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}, status=${s.status}`);
    await submitWrong(sock1);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P1 strike 2] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}, status=${s.status}`);
    await submitWrong(sock2);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P2 strike 2] strikes=${JSON.stringify(s.strikes)}, overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}, status=${s.status}`);
    await submitWrong(sock1);
    s = JSON.parse((await redis.get(key)));
    console.log(`[After P1 strike 3 -> ROUND 3 END] overallScores=${JSON.stringify(s.overallScores)}, currentRound=${s.currentRound}, status=${s.status}, winner=${s.winner}`);
    await app.close();
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=verify-trace.js.map