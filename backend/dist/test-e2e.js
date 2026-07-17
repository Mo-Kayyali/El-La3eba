"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function main() {
    const api = axios_1.default.create({ baseURL: 'http://localhost:3000' });
    const loginRes = await api.post('/auth/login', { email: 'admin@gmail.com', password: 'admin123' });
    const token = loginRes.data.access_token;
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const compRes = await api.post('/admin/competitions', {
        name: 'LaLiga',
        type: 'DOMESTIC_LEAGUE',
        countryCode: 'ESP'
    });
    const compId = compRes.data.id;
    console.log('Created Competition:', compRes.data.name);
    const clubRes = await api.post('/admin/clubs', {
        name: 'Real Madrid',
        countryCode: 'ESP',
        competitionIds: [compId],
        currentCompetitionId: compId
    });
    const clubId = clubRes.data.id;
    console.log('Created Club:', clubRes.data.name, 'with competitions:', clubRes.data.competitions);
    const playerRes = await api.post('/admin/players', {
        firstName: 'Jude',
        lastName: 'Bellingham',
        name: 'Jude Bellingham',
        nationality: 'ENG',
        positions: ['CM', 'CAM'],
        isRetired: false,
        currentClubId: clubId
    });
    const playerId = playerRes.data.id;
    console.log('Created Player:', playerRes.data.name);
    const pCheck = await api.get(`/admin/players/${playerId}`);
    console.log('Player clubs (denorm):', pCheck.data.clubs);
    console.log('Player competitions (denorm):', pCheck.data.competitions);
    console.log('PlayerClub history count:', pCheck.data.playerClubs.length);
    if (pCheck.data.competitions.includes('LaLiga')) {
        console.log('SUCCESS: LaLiga is in Player competitions array!');
    }
    else {
        console.log('FAIL: LaLiga is MISSING from Player competitions array!');
    }
}
main().catch(console.error);
//# sourceMappingURL=test-e2e.js.map