"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../../../../Programming/El-La3eba/backend/src/app.module");
const game_service_1 = require("../../../../Programming/El-La3eba/backend/src/game/game.service");
async function bootstrap() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const gameService = app.get(game_service_1.GameService);
    const testCases = [
        { guess: 'Cristian Ronaldo', expected: true },
        { guess: 'Cristiano', expected: false },
        { guess: 'Messy', expected: true },
        { guess: 'Kyliam Mbappe', expected: true },
        { guess: 'Leo Messi', expected: true },
        { guess: 'Lewy', expected: true },
        { guess: 'Vini', expected: true },
        { guess: 'CR7', expected: true }
    ];
    console.log('--- RUNNING TESTS ---');
    for (const tc of testCases) {
        const result = await gameService.guessPlayer(tc.guess);
        const accepted = !!result;
        console.log(`Guess: "${tc.guess}" -> Accepted: ${accepted} (Expected: ${tc.expected})`);
        if (accepted !== tc.expected) {
            console.error(`  [!] FAILED CASE: "${tc.guess}"`);
        }
        else {
            console.log(`  [OK]`);
        }
    }
    await app.close();
}
bootstrap();
//# sourceMappingURL=test_fuzzy.js.map