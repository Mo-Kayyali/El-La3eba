const fs = require('fs');
const stringSimilarity = require('string-similarity');
const { v4: uuidv4 } = require('uuid');

const records = JSON.parse(fs.readFileSync('parsed_records.json', 'utf-8'));

const uniquePlayers = [];
let flaggedPlayers = [];

function hasOverlappingClub(hist1, hist2) {
  if (!hist1 || !hist2) return false;
  const c1 = hist1.map(h => h.club.toLowerCase());
  const c2 = hist2.map(h => h.club.toLowerCase());
  return c1.some(c => c2.includes(c));
}

function mergeHistory(hist1, hist2) {
  const merged = [];
  const map = {};
  for (const h of [...hist1, ...hist2]) {
    const key = h.club.toLowerCase();
    if (!map[key]) {
      map[key] = { ...h };
    } else {
      if (h.start_year && !map[key].start_year) map[key].start_year = h.start_year;
      if (h.end_year && !map[key].end_year) map[key].end_year = h.end_year;
    }
  }
  return Object.values(map);
}

// Group for fast lookup
const playersByDob = {};
const allPlayers = []; // For missing DOB fallback

let processedCount = 0;

for (const r of records) {
  let matched = false;
  
  if (r.dob) {
    const candidates = playersByDob[r.dob] || [];
    for (const c of candidates) {
      if (stringSimilarity.compareTwoStrings(r.fullName.toLowerCase(), c.fullName.toLowerCase()) > 0.65) {
        matched = c;
        break;
      }
    }
  }
  
  if (!matched && !r.dob) {
    for (const c of allPlayers) {
      if (stringSimilarity.compareTwoStrings(r.fullName.toLowerCase(), c.fullName.toLowerCase()) > 0.8) {
        if (r.position === c.position || hasOverlappingClub(r.history, c.history)) {
          matched = c;
          break;
        }
      }
    }
  }
  
  if (matched) {
    // Merge r into matched
    if (r.fullName.length > matched.fullName.length) {
      matched.aliases.push(matched.fullName);
      matched.fullName = r.fullName;
    } else if (r.fullName.toLowerCase() !== matched.fullName.toLowerCase()) {
      matched.aliases.push(r.fullName);
    }
    
    if (r.aliases && r.aliases.length > 0) matched.aliases.push(...r.aliases);
    matched.aliases = [...new Set(matched.aliases)];
    
    if (!matched.firstName && r.firstName) matched.firstName = r.firstName;
    if (!matched.lastName && r.lastName) matched.lastName = r.lastName;
    if (!matched.dob && r.dob) matched.dob = r.dob;
    if (!matched.nationality && r.nationality) matched.nationality = r.nationality;
    if (!matched.heightCm && r.heightCm) matched.heightCm = r.heightCm;
    if (!matched.preferredFoot && r.preferredFoot) matched.preferredFoot = r.preferredFoot;
    if (!matched.position && r.position) matched.position = r.position;
    
    matched.history = mergeHistory(matched.history, r.history);

    // Conflict Resolution
    let cClub1 = matched.currentClub;
    let cClub2 = r.currentClub;
    let r1 = matched.isRetired;
    let r2 = r.isRetired;

    if (cClub1 && cClub2 && cClub1.toLowerCase() !== cClub2.toLowerCase()) {
      // Genuinely conflicting current clubs. 
      // We keep the player but flag them.
      flaggedPlayers.push({ name: matched.fullName, conflict: `Current clubs: ${cClub1} vs ${cClub2}` });
      // Trust the one with the highest start year in history
      let s1 = matched.history.find(h => h.club.toLowerCase() === cClub1.toLowerCase())?.start_year || 0;
      let s2 = r.history.find(h => h.club.toLowerCase() === cClub2.toLowerCase())?.start_year || 0;
      if (s2 > s1) {
        matched.currentClub = cClub2;
        matched.isRetired = r2 !== null ? r2 : false;
      }
    } else if (cClub1 && !cClub2) {
      // keep cClub1, force not retired
      matched.isRetired = false;
    } else if (!cClub1 && cClub2) {
      matched.currentClub = cClub2;
      matched.isRetired = false;
    } else {
      // No explicit clubs or they match
      if (r1 !== null && r2 !== null && r1 !== r2) {
        // One is retired, one is not, but no explicit current club. Flag.
        flaggedPlayers.push({ name: matched.fullName, conflict: `isRetired: ${r1} vs ${r2}` });
        matched.isRetired = true; // safe fallback
      } else if (r2 !== null) {
        matched.isRetired = r2;
      }
    }

  } else {
    // New Player
    r.id = uuidv4();
    uniquePlayers.push(r);
    allPlayers.push(r);
    if (r.dob) {
      if (!playersByDob[r.dob]) playersByDob[r.dob] = [];
      playersByDob[r.dob].push(r);
    }
  }
  
  processedCount++;
  if (processedCount % 1000 === 0) console.log(`Processed ${processedCount} records...`);
}

fs.writeFileSync('clean_players.json', JSON.stringify(uniquePlayers, null, 2));

const flaggedNames = [...new Set(flaggedPlayers.map(f => `${f.name} (${f.conflict})`))];
fs.writeFileSync('flagged_players.json', JSON.stringify(flaggedNames, null, 2));

console.log(`Deduplication complete. Unique players: ${uniquePlayers.length}`);
console.log(`Flagged players: ${flaggedNames.length}`);
