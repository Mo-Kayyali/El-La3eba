import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { GameGateway } from '../src/game/game.gateway';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const gameGateway = app.get(GameGateway);

  // Mock Socket client
  const mockClient = {
    id: "mock-socket-123",
    data: {
      user: {
        sub: "test-inviter-123",
        username: "InviterUser"
      }
    }
  } as any;

  const friendId = "test-invitee-456";
  const config = {
    composition: ["STRIKES", "STRIKES", "TOP_10"],
    timerConfig: {
      "STRIKES": 10000,
      "TOP_10": 15000
    }
  };

  // Temporarily mock server
  if (!gameGateway.server) {
    gameGateway.server = {
      to: () => ({
        emit: () => {}
      })
    } as any;
  }

  // We need to bypass `ensureUsersAreFriends` since these aren't real DB users.
  // We'll mock the friends service directly on the instance.
  (gameGateway as any).friendsService.ensureUsersAreFriends = async () => true;

  console.log("Sending game invite...");
  const result = await gameGateway.handleSendGameInvite(mockClient, friendId, config);
  console.log("Result:", result);

  await app.close();
}
bootstrap().catch(console.error);
