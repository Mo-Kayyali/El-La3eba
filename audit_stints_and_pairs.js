const fs = require('fs');

const cleanPlayers = JSON.parse(fs.readFileSync('clean_players.json', 'utf-8'));
const cleanClubs = JSON.parse(fs.readFileSync('clean_clubs.json', 'utf-8'));

const exactClubNames = new Set();
for (const c of cleanClubs) {
  exactClubNames.add(c.clean_name.toLowerCase());
  if (c.club_slug) exactClubNames.add(c.club_slug.replace(/-/g, ' ').toLowerCase());
}

console.log('=== MULTI-STINT COLLAPSES (STEP 6) ===');
let droppedCount = 0;

for (const p of cleanPlayers) {
  if (p.history) {
    const seenClubs = new Set();
    const droppedStints = [];
    const allStints = [];
    
    for (const h of p.history) {
      const cName = h.club.toLowerCase();
      if (exactClubNames.has(cName)) {
        if (seenClubs.has(cName)) {
          droppedStints.push(h);
        } else {
          seenClubs.add(cName);
        }
        allStints.push(h);
      }
    }
    
    if (droppedStints.length > 0) {
      console.log(`\nPlayer: ${p.fullName} (${p.dob || 'no dob'})`);
      const relatedStints = allStints.filter(h => droppedStints.map(d => d.club.toLowerCase()).includes(h.club.toLowerCase()));
      for (const st of relatedStints) {
        console.log(` - Stint: ${st.club} (${st.start_year || 'null'} - ${st.end_year || 'null'})`);
      }
      droppedCount += droppedStints.length;
    }
  }
}

console.log(`\nTotal dropped stints: ${droppedCount}\n`);

console.log('=== 5 SUSPECT PAIRS CONTEXT ===');

const suspectNames = ['Henrique', 'Luca Ceccarelli', 'Mauricio Romero', 'Michel', 'Paulinho'];

for (const sName of suspectNames) {
  const matches = cleanPlayers.filter(p => p.fullName === sName);
  console.log(`\nPair: ${sName}`);
  matches.forEach((p, idx) => {
    console.log(` Record ${idx + 1}: DOB=${p.dob}, Nat=${p.nationality}, CurrentClub=${p.currentClub}`);
    const hist = p.history ? p.history.map(h => h.club).join(', ') : 'none';
    console.log(`   History: ${hist}`);
  });
}
