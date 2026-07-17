import axios from 'axios';

async function main() {
  const api = axios.create({ baseURL: 'http://localhost:3000' });
  
  // 1. Login
  const loginRes = await api.post('/auth/login', { email: 'admin@gmail.com', password: 'admin123' });
  const token = loginRes.data.access_token;
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

  // 2. Create Competition "LaLiga"
  const compRes = await api.post('/admin/competitions', {
    name: 'LaLiga',
    type: 'DOMESTIC_LEAGUE',
    countryCode: 'ESP'
  });
  const compId = compRes.data.id;
  console.log('Created Competition:', compRes.data.name);

  // 3. Create Club "Real Madrid"
  const clubRes = await api.post('/admin/clubs', {
    name: 'Real Madrid',
    countryCode: 'ESP',
    competitionIds: [compId],
    currentCompetitionId: compId
  });
  const clubId = clubRes.data.id;
  console.log('Created Club:', clubRes.data.name, 'with competitions:', clubRes.data.competitions);

  // 4. Create Player
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

  // 5. Verify Player auto-sync & denorm
  const pCheck = await api.get(`/admin/players/${playerId}`);
  console.log('Player clubs (denorm):', pCheck.data.clubs);
  console.log('Player competitions (denorm):', pCheck.data.competitions);
  console.log('PlayerClub history count:', pCheck.data.playerClubs.length);

  // 6. Test fuzzy search via Game filter validation logic (simulated by checking DB)
  // We can just verify that pCheck.data.competitions includes "LaLiga"
  if (pCheck.data.competitions.includes('LaLiga')) {
    console.log('SUCCESS: LaLiga is in Player competitions array!');
  } else {
    console.log('FAIL: LaLiga is MISSING from Player competitions array!');
  }
}

main().catch(console.error);
