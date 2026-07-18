const fs = require('fs');

const parsed = JSON.parse(fs.readFileSync('parsed_records.json', 'utf-8'));
const cleanPlayers = JSON.parse(fs.readFileSync('clean_players.json', 'utf-8'));
const cleanClubs = JSON.parse(fs.readFileSync('clean_clubs.json', 'utf-8'));

const exactClubNames = new Set();
for (const c of cleanClubs) {
  exactClubNames.add(c.clean_name.toLowerCase());
  if (c.club_slug) exactClubNames.add(c.club_slug.replace(/-/g, ' ').toLowerCase());
}

let parsedHistoryTotal = 0;
let parsedMatched = 0;

for (const p of parsed) {
  if (p.history) {
    for (const h of p.history) {
      parsedHistoryTotal++;
      if (exactClubNames.has(h.club.toLowerCase())) parsedMatched++;
    }
  }
}

let cleanHistoryTotal = 0;
let cleanMatched = 0;
let step6DroppedSameClub = 0;

for (const p of cleanPlayers) {
  if (p.history) {
    const seenClubs = new Set();
    for (const h of p.history) {
      cleanHistoryTotal++;
      const cName = h.club.toLowerCase();
      if (exactClubNames.has(cName)) {
        cleanMatched++;
        if (seenClubs.has(cName)) {
          step6DroppedSameClub++;
        } else {
          seenClubs.add(cName);
        }
      }
    }
  }
}

console.log(`Parsed Records Matched: ${parsedMatched} (out of ${parsedHistoryTotal})`);
console.log(`Clean Players Matched: ${cleanMatched} (out of ${cleanHistoryTotal})`);
console.log(`Difference (Parsed - Clean) due to step2 deduping the players and their overlapping histories: ${parsedMatched - cleanMatched}`);
console.log(`Step 6 Dropped due to seenClubs (Multiple stints at same club): ${step6DroppedSameClub}`);
console.log(`Expected PlayerClub inserts: ${cleanMatched - step6DroppedSameClub}`);
