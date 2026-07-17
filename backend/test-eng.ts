import axios from 'axios';

async function main() {
  try {
    const api = axios.create({ baseURL: 'http://localhost:3000' });
    const loginRes = await api.post('/auth/login', { email: 'admin@gmail.com', password: 'admin123' });
    api.defaults.headers.common['Authorization'] = 'Bearer ' + loginRes.data.access_token;
    
    const compRes = await api.post('/admin/competitions', {
      name: 'Premier League',
      type: 'DOMESTIC_LEAGUE',
      countryCode: 'ENG'
    });
    console.log('SUCCESS:', compRes.data);
  } catch (err: any) {
    console.error('FAIL:', err.response?.data || 'NO DATA');
    console.error('MSG:', err.message);
  }
}
main();
