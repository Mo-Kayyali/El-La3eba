"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const game_service_1 = require("./game/game.service");
async function testDBMatch() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule);
    const gameService = app.get(game_service_1.GameService);
    const tests = [
        'mahmoud hassan trezeguet',
        'hussien elshahat',
        'hussien alshahat',
        'wessam abou',
        'wessam aboali',
        'wessam ali',
        'ashraf ben',
        'ahmed abd kadr',
        'mo salah',
        'messi'
    ];
    for (const guess of tests) {
        const results = await gameService.guessPlayer(guess);
        console.log(`\nGuess: "${guess}"`);
        if (results.length === 0) {
            console.log('  -> No matches found.');
            continue;
        }
        console.log(`  Ambiguous? ${results[0].isAmbiguous ? 'YES' : 'NO'}`);
        for (let i = 0; i < Math.min(3, results.length); i++) {
            console.log(`  ${i + 1}. [${results[i].matchConfidence.toFixed(2)}] ${results[i].name} (ID: ${results[i].id})`);
        }
    }
    await app.close();
}
testDBMatch()
    .then(() => process.exit(0))
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=test-guessPlayer.js.map