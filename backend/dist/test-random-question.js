"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./src/app.module");
const game_service_1 = require("./src/game/game.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const gameService = app.get(game_service_1.GameService);
    console.log("Fetching random STRIKES question...");
    const q = await gameService.getRandomQuestion('STRIKES');
    console.log("Result:", q);
    await app.close();
}
bootstrap();
//# sourceMappingURL=test-random-question.js.map