"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../src/app.module");
const game_gateway_1 = require("../src/game/game.gateway");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const gameGateway = app.get(game_gateway_1.GameGateway);
    const mockClient = {
        id: "mock-socket-123",
        data: {
            user: {
                sub: "test-inviter-123",
                username: "InviterUser"
            }
        }
    };
    const friendId = "test-invitee-456";
    const config = {
        composition: ["STRIKES", "STRIKES", "TOP_10"],
        timerConfig: {
            "STRIKES": 10000,
            "TOP_10": 15000
        }
    };
    if (!gameGateway.server) {
        gameGateway.server = {
            to: () => ({
                emit: () => { }
            })
        };
    }
    gameGateway.friendsService.ensureUsersAreFriends = async () => true;
    console.log("Sending game invite...");
    const result = await gameGateway.handleSendGameInvite(mockClient, friendId, config);
    console.log("Result:", result);
    await app.close();
}
bootstrap().catch(console.error);
//# sourceMappingURL=verify-invite.js.map