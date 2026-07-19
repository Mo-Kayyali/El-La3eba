"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const matchmaking_service_1 = require("../src/game/matchmaking.service");
const redis_service_1 = require("../src/redis/redis.service");
const match_evaluator_util_1 = require("../src/game/match-evaluator.util");
async function run() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const matchmaking = app.get(matchmaking_service_1.MatchmakingService);
    const redis = app.get(redis_service_1.RedisService);
    console.log('--- TEST 1: Custom Config (2 Strikes + 3 Top 10) ---');
    const hostId = 'user_host_1';
    const guestId = 'user_guest_1';
    const customConfig = {
        composition: ['STRIKES', 'STRIKES', 'TOP_10', 'TOP_10', 'TOP_10'],
        timerConfig: { STRIKES: 15000, TOP_10: 30000 }
    };
    const roomCode1 = await matchmaking.createPrivateRoom(hostId, 'socket_1', 'HostUser', customConfig);
    console.log('Created room:', roomCode1);
    const joinResult1 = await matchmaking.joinPrivateRoom(roomCode1, guestId, 'socket_2', 'GuestUser');
    console.log('Join Result:', joinResult1.success ? 'Success' : 'Failed');
    const gameSessionId1 = joinResult1.gameSessionId;
    const stateStr1 = await redis.get(`game:${gameSessionId1}`);
    let state1 = JSON.parse(stateStr1);
    console.log('Composition:', state1.composition);
    console.log('TimerConfig:', state1.timerConfig);
    console.log('Initial mode:', state1.mode);
    console.log('Turn deadline offset (ms):', state1.modeState.turnDeadlineAt - Date.now());
    console.log('Testing majority threshold check for 5 rounds...');
    state1.modeState.overallScores = { [hostId]: 2, [guestId]: 1 };
    let winCheck = (0, match_evaluator_util_1.checkBestOfNMatchWin)(state1);
    console.log(`Scores 2-1: isMatchOver=${winCheck.isMatchOver} (Expected: false)`);
    state1.modeState.overallScores = { [hostId]: 3, [guestId]: 1 };
    winCheck = (0, match_evaluator_util_1.checkBestOfNMatchWin)(state1);
    console.log(`Scores 3-1: isMatchOver=${winCheck.isMatchOver} (Expected: true), winner=${winCheck.winnerId}`);
    console.log('\n--- TEST 2: Default Config (Backward Compatibility) ---');
    const hostId2 = 'user_host_2';
    const guestId2 = 'user_guest_2';
    const roomCode2 = await matchmaking.createPrivateRoom(hostId2, 'socket_3', 'HostUser2');
    console.log('Created room:', roomCode2);
    const joinResult2 = await matchmaking.joinPrivateRoom(roomCode2, guestId2, 'socket_4', 'GuestUser2');
    console.log('Join Result:', joinResult2.success ? 'Success' : 'Failed');
    const gameSessionId2 = joinResult2.gameSessionId;
    const stateStr2 = await redis.get(`game:${gameSessionId2}`);
    const state2 = JSON.parse(stateStr2);
    console.log('Composition:', state2.composition);
    console.log('TimerConfig:', state2.timerConfig);
    console.log('Turn deadline offset (ms):', state2.modeState.turnDeadlineAt - Date.now());
    console.log('Testing majority threshold check for 3 rounds...');
    state2.modeState.overallScores = { [hostId2]: 2, [guestId2]: 0 };
    winCheck = (0, match_evaluator_util_1.checkBestOfNMatchWin)(state2);
    console.log(`Scores 2-0: isMatchOver=${winCheck.isMatchOver} (Expected: true)`);
    await app.close();
}
run().catch(console.error);
//# sourceMappingURL=verify-config.js.map