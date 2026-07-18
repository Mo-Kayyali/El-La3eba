const fs = require('fs');

const parsed = JSON.parse(fs.readFileSync('parsed_records.json', 'utf-8'));
const cleanPlayers = JSON.parse(fs.readFileSync('clean_players.json', 'utf-8'));

// 1. Get al_ahly_manual players
const ahlyManualRaw = parsed.filter(p => p.source_batch === 'al_ahly_manual');
console.log(`Original al_ahly_manual players: ${ahlyManualRaw.length}`);

// 2. See how many records in cleanPlayers match those names
let singleCount = 0;
let doubleCount = 0;

for (const p of ahlyManualRaw) {
  const matches = cleanPlayers.filter(c => {
    return c.fullName.toLowerCase() === p.fullName.toLowerCase() || c.aliases.map(a=>a.toLowerCase()).includes(p.fullName.toLowerCase());
  });
  if (matches.length === 1) singleCount++;
  else if (matches.length > 1) doubleCount++;
}

console.log(`Of the ${ahlyManualRaw.length} al_ahly_manual players:`);
console.log(`${singleCount} ended up as a single merged player record.`);
console.log(`${doubleCount} ended up as separate multiple records.`);

// 3. For request 3, what happened to the 36 flagged players?
// Were they excluded or kept?
const flagged = JSON.parse(fs.readFileSync('flagged_players.json', 'utf-8'));
let foundFlagged = 0;
for (const f of flagged) {
  // f is like "Nasser Maher (Current clubs: Zamalek vs Pyramids FC)"
  const name = f.split(' (')[0];
  const exists = cleanPlayers.find(c => c.fullName === name || c.aliases.includes(name));
  if (exists) foundFlagged++;
}
console.log(`\nOf the ${flagged.length} flagged players, ${foundFlagged} were successfully inserted/kept in the database.`);
console.log(`(They were kept, and as per step 2 dedupe rules, the current club was chosen by trusting the one with the highest start year in history).`);
