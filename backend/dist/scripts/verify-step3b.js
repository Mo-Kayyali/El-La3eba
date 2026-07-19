"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const matchmaking_service_1 = require("../src/game/matchmaking.service");
const redis_service_1 = require("../src/redis/redis.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const matchmakingService = app.get(matchmaking_service_1.MatchmakingService);
    const redisService = app.get(redis_service_1.RedisService);
    const hostId = "host-user-" + Date.now();
    const guestId = "guest-user-" + Date.now();
    const config = {
        composition: ["TOP_10", "TOP_10", "TOP_10", "TOP_10", "TOP_10"],
        timerConfig: {
            "STRIKES": 10000,
            "TOP_10": 15000
        }
    };
    const roomCode = await matchmakingService.createPrivateRoom(hostId, "socket1", "HostName", config);
    console.log("Room Created:", roomCode);
    const joinResult = await matchmakingService.joinPrivateRoom(roomCode, guestId, "socket2", "GuestName");
    console.log("Join Result:", joinResult);
    if (joinResult.success && joinResult.gameSessionId) {
        const rawState = await redisService.get(`game:${joinResult.gameSessionId}`);
        const state = JSON.parse(rawState);
        console.log("--- RAW GAME STATE DUMP ---");
        console.log(JSON.stringify(state, null, 2));
        const { checkBestOfNMatchWin } = require('../src/game/match-evaluator.util');
        const evaluator = checkBestOfNMatchWin(state);
        console.log("Evaluator result (0 round wins):", evaluator);
        state.modeState.overallScores[hostId] = 3;
        state.modeState.overallScores[guestId] = 0;
        const evaluator2 = checkBestOfNMatchWin(state);
        console.log("Evaluator result (3 round wins):", evaluator2);
    }
    await app.close();
}
bootstrap().catch(console.error);
//# sourceMappingURL=verify-step3b.js.map