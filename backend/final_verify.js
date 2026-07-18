const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('=== VERIFICATION REPORT ===\n');

  // 1. Final player count
  const playerCount = await prisma.player.count();
  console.log(`Final Player Count: ${playerCount}`);
  // Original was 14,479. I merged 2 (Omar Kamal, Marwan Attia). Expected: 14,477.
  // The 3 others (Luca, Michel, Paulinho) halted due to conflicts as requested.

  // 2. Final PlayerClub count
  const pcCount = await prisma.playerClub.count();
  console.log(`Final PlayerClub Count: ${pcCount}`);
  // Original 3332. Restored 6. Recovered 154 fuzzy. Expected: 3332 + 6 + 154 = 3492.

  // 3. Re-query restored stints
  console.log('\n--- Restored Stints (Mido, Tarek, Shehata) ---');
  const names = ['Ahmed Hossam Mido', 'Tarek El-Said', 'Hassan Shehata'];
  for (const n of names) {
    const p = await prisma.player.findFirst({
      where: { name: n },
      include: { playerClubs: { include: { club: true } } }
    });
    if (p) {
      console.log(`Player: ${p.name}`);
      p.playerClubs.forEach(pc => {
        console.log(`  - ${pc.club.name} (${pc.startYear} - ${pc.endYear})`);
      });
    }
  }

  // 4. Re-query a fuzzy-recovered row
  console.log('\n--- Fuzzy-Recovered Stints (Anderlecht/Besiktas) ---');
  const fuzzyClubs = await prisma.club.findMany({
    where: { name: { in: ['RSC Anderlecht', 'Besiktas JK'] } },
    include: { playerClubs: { include: { player: true } } }
  });
  
  for (const c of fuzzyClubs) {
    console.log(`Club: ${c.name}`);
    c.playerClubs.forEach(pc => {
       console.log(`  - Linked Player: ${pc.player.name} (${pc.startYear} - ${pc.endYear})`);
    });
  }

  // 5. Confirm no orphaned/duplicate rows for the 2 merged players
  console.log('\n--- Duplicate Merge Verification ---');
  const mergedNames = ['Omar Kamal', 'Marwan Attia'];
  for (const mn of mergedNames) {
    const matches = await prisma.player.findMany({ where: { name: mn } });
    console.log(`${mn}: ${matches.length} record(s) remaining.`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
