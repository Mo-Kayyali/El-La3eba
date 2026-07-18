const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
const stringSimilarity = require('string-similarity');

const prisma = new PrismaClient();

function normalizeClubName(name) {
  let n = name.toLowerCase();
  const terms = ['fc ', ' fc', 'rsc ', 'jk ', ' cf', 'cf ', 'sc ', ' sc', 'as ', 'ud ', 'sd ', 'club ', ' deportivo', 'atletico ', ' sporting', 'sporting '];
  for (const t of terms) {
    if (n.includes(t)) n = n.replace(t, '');
  }
  return n.trim();
}

async function run() {
  const parsed = JSON.parse(fs.readFileSync('../parsed_records.json', 'utf-8'));
  
  // We need to match parsed_records history against DB clubs
  const dbClubs = await prisma.club.findMany();
  const exactClubNames = new Set();
  const normalizedSeeded = [];

  for (const c of dbClubs) {
    const name = c.name.toLowerCase();
    exactClubNames.add(name);
    normalizedSeeded.push({ id: c.id, norm: normalizeClubName(name), orig: name });
    
    // aliases
    for (const a of c.aliases) {
      const aName = a.replace(/-/g, ' ').toLowerCase();
      if (aName !== name) {
        exactClubNames.add(aName);
        normalizedSeeded.push({ id: c.id, norm: normalizeClubName(aName), orig: aName });
      }
    }
  }

  // Get all existing player clubs to avoid duplicates
  const existingPC = await prisma.playerClub.findMany();
  const existingSet = new Set(existingPC.map(pc => `${pc.playerId}_${pc.clubId}_${pc.startYear || 'null'}`));

  // We need to map `parsed` players back to `db` players. The names should match perfectly.
  // Actually, we can just load all db players and do a Map by name.
  const dbPlayersList = await prisma.player.findMany({ select: { id: true, name: true, aliases: true } });
  const dbPlayers = {};
  for (const p of dbPlayersList) {
    dbPlayers[p.name.toLowerCase()] = p.id;
    for (const a of p.aliases) dbPlayers[a.toLowerCase()] = p.id;
  }

  let recoveredCount = 0;
  const inserts = [];

  for (const p of parsed) {
    if (!p.history) continue;
    const dbPlayerId = dbPlayers[p.fullName.toLowerCase()];
    if (!dbPlayerId) continue;

    for (const h of p.history) {
      const hName = h.club.toLowerCase();
      if (exactClubNames.has(hName)) continue; // Already matched precisely in step 6
      
      const hNorm = normalizeClubName(hName);
      let matchedClubId = null;
      let highestScore = 0;

      for (const s of normalizedSeeded) {
        if (s.norm === hNorm) {
          highestScore = 1;
          matchedClubId = s.id;
          break;
        }
        const sim = stringSimilarity.compareTwoStrings(hNorm, s.norm);
        if (sim > highestScore) {
          highestScore = sim;
          matchedClubId = s.id;
        }
        if (s.norm.length > 4 && hNorm.length > 4) {
          if (s.norm.includes(hNorm) || hNorm.includes(s.norm)) {
             if (0.9 > highestScore) {
               highestScore = 0.9;
               matchedClubId = s.id;
             }
          }
        }
      }

      if (highestScore >= 0.85 && matchedClubId) {
        // It's a recoverable fuzzy match!
        const key = `${dbPlayerId}_${matchedClubId}_${h.start_year || 'null'}`;
        if (!existingSet.has(key)) {
          existingSet.add(key); // prevent dups in memory
          inserts.push({
            id: uuidv4(),
            playerId: dbPlayerId,
            clubId: matchedClubId,
            startYear: h.start_year || null,
            endYear: h.end_year || null,
            isCurrent: false
          });
          recoveredCount++;
        }
      }
    }
  }

  console.log(`Recovered ${recoveredCount} PlayerClub rows via fuzzy matching!`);
  
  if (inserts.length > 0) {
    // Insert them
    await prisma.playerClub.createMany({
      data: inserts,
      skipDuplicates: true
    });
    console.log(`Inserted ${inserts.length} fuzzy matched rows.`);
  }

  await prisma.$disconnect();
}

run().catch(console.error);
