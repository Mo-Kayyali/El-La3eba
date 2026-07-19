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
    const gameSessionId = 'test-fullmatch-v2';
    const key = `game:${gameSessionId}`;
    gameGateway.server = { to: () => ({ emit: () => { } }) };
    gameService.guessPlayer = async () => [{ id: 'px', name: 'Wrong Player', isAmbiguous: false }];
    gameService.validateAnswer = async () => false;
    gameService.getRandomQuestion = async () => ({ id: 'qnext', targetPosition: 'ST', clubs: [], attributes: [] });
    const realStrategy = new strikes_mode_strategy_1.StrikesModeStrategy();
    const roundEndSnapshots = [];
    const instrumentedStrategy = {
        getOpponent: realStrategy.getOpponent.bind(realStrategy),
        handleDisconnectTimeout: realStrategy.handleDisconnectTimeout.bind(realStrategy),
        handleTurnTimeout: realStrategy.handleTurnTimeout.bind(realStrategy),
        checkMatchWinCondition: realStrategy.checkMatchWinCondition.bind(realStrategy),
        setupNextRound: realStrategy.setupNextRound.bind(realStrategy),
        handleGuess: (state, userId, guessResult) => {
            const outcome = realStrategy.handleGuess(state, userId, guessResult);
            if (outcome.isRoundOver) {
                roundEndSnapshots.push({
                    label: `Round ${state.currentRound} ended — winner: ${outcome.roundWinner}`,
                    overallScores: { ...state.overallScores },
                    currentRound: state.currentRound,
                    isMatchOver: outcome.isMatchOver,
                    status: state.status,
                    winner: state.winner ?? null,
                });
            }
            return outcome;
        },
    };
    gameGateway.strategy = instrumentedStrategy;
    const initialState = {
        players: [p1, p2],
        status: 'in_progress',
        isRanked: false,
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
    await redis.set(key, JSON.stringify(initialState));
    const sock1 = { id: 's1', data: { user: { userId: p1 } }, emit: () => { } };
    const sock2 = { id: 's2', data: { user: { userId: p2 } }, emit: () => { } };
    const wrong = async (sock) => gameGateway.handleSubmitGuess(sock, { gameSessionId, guessName: 'Wrong' });
    const logRedis = async (label) => {
        const s = JSON.parse((await redis.get(key)));
        console.log(`[${label}] round=${s.currentRound}, overallScores=${JSON.stringify(s.overallScores)}, status=${s.status}, winner=${s.winner ?? 'None'}`);
    };
    console.log('\n=== SCENARIO A: 2-0 match (P1 wins rounds 1 and 2) ===');
    console.log('\n--- Round 1: P2 gets 3 strikes (P1 wins round) ---');
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock2);
    await redis.set(key, JSON.stringify({ ...initialState, overallScores: { [p1]: 0, [p2]: 0 } }));
    roundEndSnapshots.length = 0;
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock1);
    console.log('\n[ROUND 1 END SNAPSHOT from strategy — before next-round write]:');
    console.log(JSON.stringify(roundEndSnapshots[0], null, 2));
    await logRedis('AFTER R1 (Redis — already contains next-round setup)');
    console.log('\n--- Round 2: P1 gets 3 strikes (P2 wins round & match 2-0) ---');
    await wrong(sock2);
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock1);
    await wrong(sock2);
    await logRedis('ROUND 2 START');
    console.log('\n[ROUND 2 END SNAPSHOT from strategy]:');
    console.log(JSON.stringify(roundEndSnapshots[1] ?? '(not yet)', null, 2));
    await logRedis('AFTER R2 (should be match_completed if 2-0)');
    console.log('\n\n=== SCENARIO B: Full BO3 (1-1 going into round 3, P2 wins R3) ===');
    await redis.set(key, JSON.stringify({
        ...initialState,
        currentRound: 3,
        overallScores: { [p1]: 1, [p2]: 1 },
        currentTurn: p1,
    }));
    roundEndSnapshots.length = 0;
    console.log('\n--- Round 3: P1 gets 3 strikes (P2 wins match) ---');
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock1);
    console.log('\n[ROUND 3 END SNAPSHOT from strategy — before any redis write]:');
    console.log(JSON.stringify(roundEndSnapshots[0], null, 2));
    await logRedis('AFTER R3 (Redis — should be match_completed, winner=user-2)');
    console.log('\n\n=== SCENARIO C: P1 wins 2-0 (overallScores reaches 2 for P1) ===');
    await redis.set(key, JSON.stringify({
        ...initialState,
        currentRound: 2,
        overallScores: { [p1]: 1, [p2]: 0 },
        currentTurn: p2,
    }));
    roundEndSnapshots.length = 0;
    console.log('\n--- Round 2: P2 gets 3 strikes (P1 wins match 2-0) ---');
    await wrong(sock2);
    await wrong(sock1);
    await wrong(sock2);
    await wrong(sock1);
    await wrong(sock2);
    console.log('\n[ROUND 2 END SNAPSHOT from strategy]:');
    console.log(JSON.stringify(roundEndSnapshots[0], null, 2));
    await logRedis('AFTER (should be match_completed, winner=user-1, overallScores user-1:2)');
    await app.close();
    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=verify-match.js.map