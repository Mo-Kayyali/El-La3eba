const fs = require('fs');
const stringSimilarity = require('string-similarity');

const parsed = JSON.parse(fs.readFileSync('parsed_records.json', 'utf-8'));
const cleanClubs = JSON.parse(fs.readFileSync('clean_clubs.json', 'utf-8'));

// Build club name lists
const exactClubNames = new Set();
const seededClubs = [];

for (const c of cleanClubs) {
  const name = c.clean_name.toLowerCase();
  exactClubNames.add(name);
  seededClubs.push({ name: name, orig: c.clean_name });
  
  const slug = c.club_slug ? c.club_slug.replace(/-/g, ' ').toLowerCase() : '';
  if (slug && slug !== name) {
    exactClubNames.add(slug);
    seededClubs.push({ name: slug, orig: c.clean_name });
  }
}

// Prefix/Suffix stripper
function normalizeClubName(name) {
  let n = name.toLowerCase();
  // remove common terms
  const terms = ['fc ', ' fc', 'rsc ', 'jk ', ' cf', 'cf ', 'sc ', ' sc', 'as ', 'ud ', 'sd ', 'club ', ' deportivo', 'atletico ', ' sporting', 'sporting '];
  for (const t of terms) {
    if (n.includes(t)) n = n.replace(t, '');
  }
  return n.trim();
}

const normalizedSeeded = seededClubs.map(c => ({
  norm: normalizeClubName(c.name),
  orig: c.orig
}));

let totalEntries = 0;
let exactlyMatched = 0;
let fuzzyMatched = 0;
let outOfScope = 0;

for (const p of parsed) {
  if (!p.history) continue;
  for (const h of p.history) {
    totalEntries++;
    const hName = h.club.toLowerCase();
    
    if (exactClubNames.has(hName)) {
      exactlyMatched++;
    } else {
      // Try fuzzy matching
      const hNorm = normalizeClubName(hName);
      let bestMatch = null;
      let highestScore = 0;

      for (const s of normalizedSeeded) {
        // substring match or similarity > 0.85
        if (s.norm === hNorm) {
          highestScore = 1;
          break;
        }
        const sim = stringSimilarity.compareTwoStrings(hNorm, s.norm);
        if (sim > highestScore) highestScore = sim;
        
        // Check substring if the length is decent
        if (s.norm.length > 4 && hNorm.length > 4) {
          if (s.norm.includes(hNorm) || hNorm.includes(s.norm)) {
             highestScore = Math.max(highestScore, 0.9);
          }
        }
      }

      if (highestScore >= 0.85) {
        fuzzyMatched++;
      } else {
        outOfScope++;
      }
    }
  }
}

console.log(`Total History Entries parsed: ${totalEntries}`);
console.log(`Exactly Matched (Linked previously): ${exactlyMatched}`);
console.log(`Lost to formatting (Recoverable): ${fuzzyMatched}`);
console.log(`Correctly Out of Scope: ${outOfScope}`);
