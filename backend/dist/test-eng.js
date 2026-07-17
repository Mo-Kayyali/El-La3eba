"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function main() {
    try {
        const api = axios_1.default.create({ baseURL: 'http://localhost:3000' });
        const loginRes = await api.post('/auth/login', { email: 'admin@gmail.com', password: 'admin123' });
        api.defaults.headers.common['Authorization'] = 'Bearer ' + loginRes.data.access_token;
        const compRes = await api.post('/admin/competitions', {
            name: 'Premier League',
            type: 'DOMESTIC_LEAGUE',
            countryCode: 'ENG'
        });
        console.log('SUCCESS:', compRes.data);
    }
    catch (err) {
        console.error('FAIL:', err.response?.data || 'NO DATA');
        console.error('MSG:', err.message);
    }
}
main();
//# sourceMappingURL=test-eng.js.map