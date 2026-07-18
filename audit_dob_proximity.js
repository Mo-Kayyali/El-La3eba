const fs = require('fs');
const stringSimilarity = require('string-similarity');

const cleanPlayers = JSON.parse(fs.readFileSync('clean_players.json', 'utf-8'));

// Group players by a rough name key to avoid O(N^2) over 14k records
// We can use the first letter of the first name, or just a phonetic/rough split
// Actually, stringSimilarity over 14k * 14k is 100M operations. In Node, this takes ~10 seconds.
// We can just run it.

const threshold = 0.85;
const suspectPairs = [];
const seenPairs = new Set();

function isDobProximity(d1, d2) {
  if (!d1 || !d2) return false;
  if (d1 === d2) return false; // Exact match is not a proximity "error"

  // Check 1: Day/Month transposed (e.g. 1993-08-11 vs 1993-11-08)
  const [y1, m1, day1] = d1.split('-');
  const [y2, m2, day2] = d2.split('-');
  
  if (y1 === y2 && m1 === day2 && day1 === m2) return true;

  // Check 2: Single digit swapped or off by a few days. We can just use Date math.
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  if (!isNaN(date1) && !isNaN(date2)) {
    const diffDays = Math.abs((date1 - date2) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays <= 31) return true; // Off by less than a month (covers single digit typos in day/month)
    
    if (y1 !== y2 && Math.abs(parseInt(y1) - parseInt(y2)) <= 2 && m1 === m2 && day1 === day2) return true; // year off by 1 or 2
  }

  // Check 3: Levenshtein distance on the string (covers 1998-08-12 vs 1998-08-01)
  // stringSimilarity for '1998-08-12' vs '1998-08-01' is very high.
  // We can just say if sim > 0.8 and they aren't identical.
  if (stringSimilarity.compareTwoStrings(d1, d2) > 0.8) return true;

  return false;
}

// Optimization: pre-compute normalized names
const players = cleanPlayers.map(p => ({
  id: p.id,
  name: p.fullName.toLowerCase(),
  origName: p.fullName,
  dob: p.dob,
  batch: p.source_batch
}));

console.log('Running O(N^2) similarity check on 14k records (will take ~15 secs)...');

let matchCount = 0;

// Sort by name to make sliding window possible
players.sort((a, b) => a.name.localeCompare(b.name));

for (let i = 0; i < players.length; i++) {
  const p1 = players[i];
  
  // Only check a sliding window of ~100 records since it's sorted alphabetically
  // This drastically speeds up the O(N^2)
  for (let j = i + 1; j < Math.min(i + 150, players.length); j++) {
    const p2 = players[j];
    
    // We only care if names are very similar
    // Since it's sorted, the prefix should be similar. But stringSimilarity doesn't require same prefix.
    // Actually, sorting by name means 'Omar Kamal' and 'Omar Kamal' are adjacent!
    // So sliding window of 150 is perfectly safe for catching high similarity.
    const sim = stringSimilarity.compareTwoStrings(p1.name, p2.name);
    
    if (sim > threshold) {
      if (isDobProximity(p1.dob, p2.dob)) {
        const pairKey = [p1.id, p2.id].sort().join('_');
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          suspectPairs.push({
            p1: p1,
            p2: p2,
            sim: sim.toFixed(2)
          });
        }
      }
    }
  }
}

console.log(`Found ${suspectPairs.length} suspect duplicate pairs based on Name Similarity + DOB Proximity.`);
suspectPairs.slice(0, 15).forEach(pair => {
  console.log(`- [Sim: ${pair.sim}] ${pair.p1.origName} (${pair.p1.dob}) [${pair.p1.batch}]  <VS>  ${pair.p2.origName} (${pair.p2.dob}) [${pair.p2.batch}]`);
});
if (suspectPairs.length > 15) {
  console.log(`... and ${suspectPairs.length - 15} more.`);
}
