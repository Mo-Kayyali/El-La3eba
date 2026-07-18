const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function run() {
  const targetRows = new Set();
  for (let i = 14389; i <= 14488; i++) targetRows.add(i);
  for (let i = 14543; i <= 14592; i++) targetRows.add(i);

  let currentRow = 1; // 1-based index (header is 1)
  const namesToPatch = [];

  console.log('Parsing CSV to extract names...');
  await new Promise((resolve, reject) => {
    fs.createReadStream('../RAW_ALL_PLAYERS.csv')
      .pipe(csv())
      .on('data', (row) => {
        currentRow++;
        if (targetRows.has(currentRow)) {
          // As seen earlier, name is under `name` column due to shifting in these batches
          let name = row.name;
          if (!name) name = row.player_name;
          if (!name) name = row.fullName;
          if (name) {
             namesToPatch.push(name.trim());
          } else {
             console.log(`Row ${currentRow} missing name!`, row);
          }
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  console.log(`Found ${namesToPatch.length} names to patch.`);

  let updatedCount = 0;
  for (const n of namesToPatch) {
    const p = await prisma.player.findFirst({ where: { name: n } });
    if (p) {
       await prisma.player.update({
         where: { id: p.id },
         data: {
           nationality: 'EGY',
           isRetired: true
         }
       });
       updatedCount++;
    } else {
       console.log(`Player not found in DB: ${n}`);
    }
  }

  console.log(`Successfully patched ${updatedCount} Egyptian Legends.`);
  await prisma.$disconnect();
}

run().catch(console.error);
