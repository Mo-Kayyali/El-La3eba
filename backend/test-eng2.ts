import axios from 'axios';

axios.post('http://127.0.0.1:3000/auth/login', { email: 'admin@gmail.com', password: 'admin123' })
  .then(res => {
    return axios.post('http://127.0.0.1:3000/admin/competitions', {
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
