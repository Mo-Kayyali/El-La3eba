import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MatchmakingService } from '../src/game/matchmaking.service';
import { RedisService } from '../src/redis/redis.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const matchmakingService = app.get(MatchmakingService);
  const redisService = app.get(RedisService);

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
    const state = JSON.parse(rawState!);
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
