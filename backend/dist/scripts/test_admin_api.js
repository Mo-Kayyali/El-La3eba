"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function run() {
    try {
        const res = await axios_1.default.post('http://localhost:3000/auth/login', { email: 'mohammed.kayyali@gmail.com', password: 'password' });
        const token = res.data.token;
        console.log('Login OK');
        const api = axios_1.default.create({ baseURL: 'http://localhost:3000', headers: { Authorization: 'Bearer ' + token } });
        const endpoints = [
            { url: '/admin/players', search: 'mohamed', name: 'Players' },
            { url: '/admin/clubs', search: 'ahly', name: 'Clubs' },
            { url: '/admin/competitions', search: 'premier', name: 'Competitions' },
            { url: '/admin/questions', search: 'strikes', name: 'Questions' },
            { url: '/admin/suggestions', name: 'Suggestions' },
        ];
        for (const ep of endpoints) {
            console.log('\nTesting ' + ep.name + '...');
            try {
                const res = await api.get(ep.url, { params: { limit: 2, search: ep.search } });
                const { data, meta } = res.data;
                console.log('- Format: ' + (Array.isArray(data) ? 'Array (OK)' : 'NOT ARRAY') + ' and meta: ' + (meta ? 'Present (OK)' : 'MISSING'));
                if (meta)
                    console.log('- Meta: total=' + meta.total + ', page=' + meta.page + ', totalPages=' + meta.totalPages);
                if (data && data.length > 0)
                    console.log('- First item: ' + (data[0].name || data[0].text || data[0].guessText));
            }
            catch (err) {
                console.error('- Error:', err.response?.data || err.message);
            }
        }
    }
    catch (e) {
        console.error('Login error', e.message);
    }
}
run();
//# sourceMappingURL=test_admin_api.js.map