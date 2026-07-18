const fs = require('fs');

const parsed = JSON.parse(fs.readFileSync('parsed_records.json', 'utf-8'));
const cleanPlayers = JSON.parse(fs.readFileSync('clean_players.json', 'utf-8'));

// Part A: al_ahly_manual vs phase2_current_squads_21clubs
const ahlyManualRaw = parsed.filter(p => p.source_batch === 'al_ahly_manual');
const phase2Ahly = parsed.filter(p => p.source_batch === 'phase2_current_squads_21clubs' && p.currentClub === 'Al Ahly');

const failedAlAhly = [];

for (const p of ahlyManualRaw) {
  const matches = cleanPlayers.filter(c => {
    return c.fullName.toLowerCase() === p.fullName.toLowerCase() || c.aliases.map(a=>a.toLowerCase()).includes(p.fullName.toLowerCase());
  });
  if (matches.length > 1) {
    // It exists as multiple separate records in clean_players, meaning it didn't merge!
    // Let's find its phase2 equivalent in parsed_records to see the differences
    // We can do this by looking for the closest string match in phase2Ahly
    let bestMatch = null;
    let highestSim = 0;
    const stringSimilarity = require('string-similarity');
    for (const p2 of phase2Ahly) {
      const sim = stringSimilarity.compareTwoStrings(p.fullName.toLowerCase(), p2.fullName.toLowerCase());
      if (sim > highestSim) {
        highestSim = sim;
        bestMatch = p2;
      }
    }
    
    failedAlAhly.push({
      manualName: p.fullName,
      manualDob: p.dob || 'null',
      phase2Name: bestMatch ? bestMatch.fullName : 'Not found',
      phase2Dob: bestMatch ? bestMatch.dob || 'null' : 'null',
    });
  }
}

console.log('=== Al Ahly Merge Failures ===');
failedAlAhly.forEach(f => {
  console.log(`Manual:  Name="${f.manualName}", DOB="${f.manualDob}"`);
  console.log(`Phase 2: Name="${f.phase2Name}", DOB="${f.phase2Dob}"\n`);
});

// Part B: check duplicates in phase3_legends_batch1/batch2 vs phase4_alahly_zamalek_history vs phase4_pyramids_ismaily_history vs phase5_national_team
const overlapBatches = [
  'phase3_legends_batch1',
  'phase3_legends_batch2',
  'phase4_alahly_zamalek_history',
  'phase4_pyramids_ismaily_history',
  'phase5_national_team'
];

const overlapRaw = parsed.filter(p => overlapBatches.includes(p.source_batch));
console.log(`\nOriginal overlap batch records: ${overlapRaw.length}`);

// We need to see how many players in clean_players.json came from these batches
// Wait, step2_dedupe didn't preserve arrays of source batches. 
// So how do we find duplicate records in clean_players?
// We can just look for clean_players whose names are very similar to each other (>0.85) AND are both from the overlap batches?
// Actually, we can just group overlapRaw by clean_player they got mapped to, or just find any clean_players that have near-identical names.

const stringSimilarity = require('string-similarity');
let overlapDuplicatesFound = 0;
const seenOverlapPairs = new Set();

// A simple way to find un-merged duplicates in clean_players from these specific batches:
// For each overlapRaw record, see how many records in clean_players it matches closely.
for (let i = 0; i < overlapRaw.length; i++) {
  const r1 = overlapRaw[i];
  for (let j = i + 1; j < overlapRaw.length; j++) {
    const r2 = overlapRaw[j];
    const sim = stringSimilarity.compareTwoStrings(r1.fullName.toLowerCase(), r2.fullName.toLowerCase());
    if (sim > 0.85 && r1.source_batch !== r2.source_batch) {
      // Very similar name, from different overlap batches. Did they merge into the same clean player?
      // Find them in cleanPlayers
      const c1 = cleanPlayers.find(c => c.fullName === r1.fullName || c.aliases.includes(r1.fullName));
      const c2 = cleanPlayers.find(c => c.fullName === r2.fullName || c.aliases.includes(r2.fullName));
      
      if (c1 && c2 && c1.id !== c2.id) {
        // They didn't merge!
        const pairKey = [c1.id, c2.id].sort().join('_');
        if (!seenOverlapPairs.has(pairKey)) {
          seenOverlapPairs.add(pairKey);
          overlapDuplicatesFound++;
        }
      }
    }
  }
}

console.log(`\nUnmerged duplicate pairs found across the 5 overlap batches: ${overlapDuplicatesFound}`);
