"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
axios_1.default.post('http://127.0.0.1:3000/auth/login', { email: 'admin@gmail.com', password: 'admin123' })
    .then(res => {
    return axios_1.default.post('http://127.0.0.1:3000/admin/competitions', {
        name: 'Premier League',
        type: 'DOMESTIC_LEAGUE',
        countryCode: 'ENG'
    }, { headers: { Authorization: `Bearer ${res.data.access_token}` } });
})
    .then(res => {
    console.log('SUCCESS:', res.data);
})
    .catch(err => {
    console.error('ERROR RESPONSE:', err.response?.data);
    console.error('ERROR MESSAGE:', err.message);
});
//# sourceMappingURL=test-eng2.js.map