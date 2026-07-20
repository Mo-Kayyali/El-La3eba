import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { MatchmakingService } from '../src/game/matchmaking.service';
import { GameGateway } from '../src/game/game.gateway';
import { RedisService } from '../src/redis/redis.service';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function verifyMultiInvite(matchmakingService: MatchmakingService, gateway: GameGateway) {
  console.log("\n=== 1. Multi-invite invalidation ===");
  const hostId = "host1_" + Date.now();
  const guest1 = "guest1_" + Date.now();
  const guest2 = "guest2_" + Date.now();

  // Create lobby
  const createRes = await matchmakingService.createPrivateRoom(hostId, "socket_h", "Host");
  const roomCode = createRes.roomCode!;

  // Mock sending invites via redis manually (since gateway handlers need sockets)
  const redis = (matchmakingService as any).redisClient;
  await redis.sadd(`game_invites_sent:${hostId}`, guest1);
  await redis.sadd(`game_invites_sent:${hostId}`, guest2);
  
  await redis.set(`game_invite:${hostId}:${guest1}`, JSON.stringify({ inviterId: hostId, inviteeId: guest1, roomCode }));
  await redis.set(`game_invite:${hostId}:${guest2}`, JSON.stringify({ inviterId: hostId, inviteeId: guest2, roomCode }));

  // Simulate gateway's acceptGameInvite logic for guest1
  const joinResult = await matchmakingService.joinPrivateRoom(roomCode, guest1, "socket_g1", "Guest 1");
  console.log("joinResult:", joinResult.success);

  // Invalidate other pending invites sent by this host
  const inviterId = joinResult.roomData!.hostId;
  const otherInvitees = await redis.smembers(`game_invites_sent:${inviterId}`);
  console.log("Other invitees found:", otherInvitees);
  
  if (otherInvitees && otherInvitees.length > 0) {
    const multi = redis.multi();
    otherInvitees.forEach((otherId: string) => {
      multi.del(`game_invite:${inviterId}:${otherId}`);
      // Simulate emitting inviteCancelledBySystem to otherId
      if (otherId !== guest1) {
        console.log(`[EMIT] to ${otherId}: 'inviteCancelledBySystem', reason: 'room_full'`);
      }
    });
    multi.del(`game_invites_sent:${inviterId}`);
    await multi.exec();
  }
}

async function verifyServerSideReady(matchmakingService: MatchmakingService) {
  console.log("\n=== 2. Server-side ready enforcement ===");
  const hostId = "host2_" + Date.now();
  const guestId = "guest3_" + Date.now();
  
  const createRes = await matchmakingService.createPrivateRoom(hostId, "socket_h2", "Host2");
  const roomCode = createRes.roomCode!;
  await matchmakingService.joinPrivateRoom(roomCode, guestId, "socket_g3", "Guest3");

  // Host readies up, but guest does not
  await matchmakingService.toggleLobbyReady(hostId);
  
  const startRes = await matchmakingService.startLobbyMatch(hostId);
  console.log("startLobbyMatch result with 1 ready:", startRes);
}

async function verifyLeaveLobby(matchmakingService: MatchmakingService) {
  console.log("\n=== 3. leaveLobby guest reset ===");
  const hostId = "host3_" + Date.now();
  const guestId = "guest4_" + Date.now();

  const createRes = await matchmakingService.createPrivateRoom(hostId, "socket_h3", "Host3");
  const roomCode = createRes.roomCode!;
  await matchmakingService.joinPrivateRoom(roomCode, guestId, "socket_g4", "Guest4");

  await matchmakingService.toggleLobbyReady(hostId);
  await matchmakingService.toggleLobbyReady(guestId);

  const redis = (matchmakingService as any).redisClient;
  let roomDataStr = await redis.get(`private_room:${roomCode}`);
  console.log("Room before guest leaves:");
  console.log(JSON.parse(roomDataStr));

  await matchmakingService.leaveLobby(guestId);

  roomDataStr = await redis.get(`private_room:${roomCode}`);
  console.log("Room after guest leaves:");
  console.log(JSON.parse(roomDataStr));
}

async function verifyDurableSweep(matchmakingService: MatchmakingService) {
  console.log("\n=== 4. Durable sweep ===");
  const hostId = "host4_" + Date.now();
  const createRes = await matchmakingService.createPrivateRoom(hostId, "socket_h4", "Host4");
  const roomCode = createRes.roomCode!;
  
  const redis = (matchmakingService as any).redisClient;
  // Modify score to near-past to simulate expiry
  await redis.zadd('private_rooms_expiry', Date.now() - 1000, roomCode);
  
  console.log("Before sweep:");
  console.log("ZSET score:", await redis.zscore('private_rooms_expiry', roomCode));
  console.log("Room Key exists:", await redis.exists(`private_room:${roomCode}`));
  console.log("User Room Key exists:", await redis.exists(`user_room:${hostId}`));

  // Manually run sweep
  await matchmakingService.handleMatchmakingInterval();
  await (matchmakingService as any).purgeExpiredPrivateRooms();

  console.log("After sweep:");
  console.log("ZSET score:", await redis.zscore('private_rooms_expiry', roomCode));
  console.log("Room Key exists:", await redis.exists(`private_room:${roomCode}`));
  console.log("User Room Key exists:", await redis.exists(`user_room:${hostId}`));
}

async function verifyRateLimits(matchmakingService: MatchmakingService) {
  console.log("\n=== 5. Rate limits ===");
  const userId = "rate_limit_user_" + Date.now();

  const create1 = await matchmakingService.createPrivateRoom(userId, "socket_r1", "RLUser");
  console.log("create1 success:", create1.success);

  const cancel1 = await matchmakingService.cancelPrivateRoom(userId);
  console.log("cancel1 success:", cancel1.success);

  const create2 = await matchmakingService.createPrivateRoom(userId, "socket_r1", "RLUser");
  console.log("create2 (within 3s):", create2);

  const joinQ1 = await matchmakingService.joinQueue(userId, "sock_q1", "RL", "ranked");
  console.log("joinQueue 1:", joinQ1.success);

  const joinQ2 = await matchmakingService.joinQueue(userId, "sock_q1", "RL", "ranked");
  console.log("joinQueue 2 (within 2s):", joinQ2);
}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const matchmakingService = app.get(MatchmakingService);
  const gateway = app.get(GameGateway);

  await verifyMultiInvite(matchmakingService, gateway);
  await verifyServerSideReady(matchmakingService);
  await verifyLeaveLobby(matchmakingService);
  await verifyDurableSweep(matchmakingService);
  await verifyRateLimits(matchmakingService);

  await app.close();
}

bootstrap().catch(console.error);
