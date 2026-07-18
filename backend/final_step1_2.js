const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const pairsToMerge = [
  { name: 'Omar Kamal', dob1: '1993-09-29', dob2: '1993-08-11', canonicalDob: '1993-09-29' },
  { name: 'Marwan Attia', dob1: '1998-08-12', dob2: '1998-08-01', canonicalDob: '1998-08-12' },
  { name: 'Luca Ceccarelli', dob1: '1983-03-20', dob2: '1983-03-24', canonicalDob: '1983-03-20' },
  { name: 'Michel', dob1: '1981-06-09', dob2: '1981-06-08', canonicalDob: '1981-06-09' },
  { name: 'Paulinho', dob1: '1982-07-14', dob2: '1982-07-16', canonicalDob: '1982-07-14' }
];

function isSameDate(d1, isoString) {
  if (!d1) return false;
  return d1.toISOString().startsWith(isoString);
}

async function run() {
  for (const pair of pairsToMerge) {
    const players = await prisma.player.findMany({
      where: { name: pair.name },
      include: { playerClubs: true }
    });

    const p1 = players.find(p => isSameDate(p.dateOfBirth, pair.dob1));
    const p2 = players.find(p => isSameDate(p.dateOfBirth, pair.dob2));

    if (!p1 || !p2) {
      console.log(`Pair not fully found for ${pair.name}. Skipping.`);
      continue;
    }

    const canonical = pair.dob1 === pair.canonicalDob ? p1 : p2;
    const duplicate = pair.dob1 === pair.canonicalDob ? p2 : p1;

    console.log(`\nMerging ${pair.name} (Duplicate ${duplicate.id} into Canonical ${canonical.id})...`);

    // Merge logic
    // 1. Check for conflicts
    const conflicts = [];
    const updates = {};
    const fieldsToCheck = ['heightCm', 'preferredFoot', 'primaryPosition', 'isRetired', 'currentClubId'];
    
    for (const f of fieldsToCheck) {
      if (duplicate[f] !== null && canonical[f] === null) {
        updates[f] = duplicate[f];
      } else if (duplicate[f] !== null && canonical[f] !== null && duplicate[f] !== canonical[f]) {
        conflicts.push(`Conflict on ${f}: Canonical=${canonical[f]}, Duplicate=${duplicate[f]}`);
      }
    }

    if (conflicts.length > 0) {
      console.log(`  => HALT: Conflicts detected for ${pair.name}:`);
      conflicts.forEach(c => console.log(`     ${c}`));
      console.log('     Skipping this merge to let the user decide.');
      continue;
    }

    // 2. Re-assign PlayerClubs
    if (duplicate.playerClubs.length > 0) {
      await prisma.playerClub.updateMany({
        where: { playerId: duplicate.id },
        data: { playerId: canonical.id }
      });
      console.log(`  => Re-assigned ${duplicate.playerClubs.length} PlayerClub rows.`);
    }

    // 3. Apply updates to Canonical
    if (Object.keys(updates).length > 0) {
      await prisma.player.update({
        where: { id: canonical.id },
        data: updates
      });
      console.log(`  => Updated canonical with missing fields: ${Object.keys(updates).join(', ')}`);
    }

    // 4. Delete Duplicate
    await prisma.player.delete({ where: { id: duplicate.id } });
    console.log(`  => Deleted duplicate player record.`);
  }

  await prisma.$disconnect();
}
run().catch(console.error);
