"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const players_service_1 = require("../src/admin/players.service");
const clubs_service_1 = require("../src/admin/clubs.service");
const competitions_service_1 = require("../src/admin/competitions.service");
const questions_service_1 = require("../src/admin/questions.service");
const suggestions_service_1 = require("../src/admin/suggestions.service");
class MockPrismaService extends client_1.PrismaClient {
}
async function run() {
    const prismaService = new MockPrismaService();
    const playersService = new players_service_1.AdminPlayersService(prismaService);
    const clubsService = new clubs_service_1.AdminClubsService(prismaService);
    const compsService = new competitions_service_1.AdminCompetitionsService(prismaService);
    const questionsService = new questions_service_1.AdminQuestionsService(prismaService, {});
    const suggestionsService = new suggestions_service_1.SuggestionsService(prismaService);
    const tests = [
        { name: 'Players', service: playersService, filter: { search: 'mohamed', limit: 2 } },
        { name: 'Clubs', service: clubsService, filter: { search: 'ahly', limit: 2 } },
        { name: 'Competitions', service: compsService, filter: { search: 'premier', limit: 2 } },
        { name: 'Questions', service: questionsService, filter: { search: 'strikes', limit: 2 } },
        { name: 'Suggestions', service: suggestionsService, filter: { limit: 2 } },
    ];
    for (const test of tests) {
        console.log(`\nTesting ${test.name}...`);
        try {
            const res = test.name === 'Suggestions'
                ? await test.service.getAllSuggestions(test.filter)
                : await test.service.findAll(test.filter);
            const { data, meta } = res;
            console.log(`- Format: ${Array.isArray(data) ? 'Array (OK)' : 'NOT ARRAY'} and meta: ${meta ? 'Present (OK)' : 'MISSING'}`);
            if (meta) {
                console.log(`- Meta: total=${meta.total}, page=${meta.page}, totalPages=${meta.totalPages}`);
            }
            if (data && data.length > 0) {
                console.log(`- First item: ${data[0].name || data[0].text || data[0].guessText || 'Unknown field'}`);
            }
        }
        catch (err) {
            console.error(`- Error:`, err.message);
        }
    }
    await prismaService.$disconnect();
}
run().catch(console.error);
//# sourceMappingURL=test_admin_services.js.map