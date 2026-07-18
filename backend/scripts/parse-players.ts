import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function normalize(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const dataPath = path.join(__dirname, '../../players.json');
  const players = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const countries = await prisma.country.findMany();
  const countryMap = new Map<string, string>(); // normalized name -> id
  for (const c of countries) {
    countryMap.set(normalize(c.name), c.id);
    countryMap.set(normalize(c.id), c.id);
  }

  // Common aliases for countries that might be in the JSON
  const countryAliases: Record<string, string> = {
    'usa': 'USA',
    'united states': 'USA',
    'england': 'ENG',
    'scotland': 'SCO',
    'wales': 'WAL',
    'northern ireland': 'NIR',
    'netherlands': 'NLD',
    'holland': 'NLD',
    'italy': 'ITA',
    'spain': 'ESP',
    'germany': 'DEU',
    'west germany': 'DEU',
    'france': 'FRA',
    'brazil': 'BRA',
    'argentina': 'ARG',
    'portugal': 'PRT',
    'uruguay': 'URY',
    'soviet union': 'RUS', // usually maps to Russia for legacy records, but we'll flag it if not found
    'yugoslavia': 'SRB', // legacy
    'czechoslovakia': 'CZE',
    'ireland': 'IRL',
    'republic of ireland': 'IRL',
    'south korea': 'KOR',
    'north macedonia': 'MKD',
    'russia': 'RUS',
    'iran': 'IRN',
    'venezuela': 'VEN'
  };

  const resolveCountry = (name: string) => {
    const norm = normalize(name);
    if (countryMap.has(norm)) return countryMap.get(norm)!;
    
    // check aliases
    const lower = name.toLowerCase();
    if (countryAliases[lower] && countryMap.has(normalize(countryAliases[lower]))) {
      return countryMap.get(normalize(countryAliases[lower]))!;
    }
    return null;
  };

  const existingClubs = await prisma.club.findMany();
  
  const unresolvedNationalities = new Set<string>();
  const ambiguousClubs = new Set<string>();
  const newClubs = new Map<string, { country: string }>();
  let duplicatesSkipped = 0;

  console.log(`Analyzing ${players.length} players...`);

  // To check duplicates, we need existing players
  const existingPlayersMap = new Set<string>();
  const allPlayers = await prisma.player.findMany({ select: { name: true, nationality: true, dateOfBirth: true } });
  for (const p of allPlayers) {
    const dob = p.dateOfBirth ? p.dateOfBirth.toISOString().split('T')[0] : 'null';
    existingPlayersMap.add(`${normalize(p.name)}_${p.nationality}_${dob}`);
  }

  for (const player of players) {
    const countryId = resolveCountry(player.nationality);
    if (!countryId) {
      unresolvedNationalities.add(player.nationality);
      continue;
    }

    const dobStr = player.dateOfBirth || 'null';
    const playerKey = `${normalize(player.name)}_${countryId}_${dobStr}`;
    if (existingPlayersMap.has(playerKey)) {
      duplicatesSkipped++;
    }

    if (player.clubs) {
      for (const club of player.clubs) {
        const cNorm = normalize(club.clubName);
        const exactMatch = existingClubs.find(c => normalize(c.name) === cNorm || c.aliases.some(a => normalize(a) === cNorm));
        
        if (!exactMatch) {
          // Check for partial matches that might be ambiguous
          const partialMatches = existingClubs.filter(c => c.name.toLowerCase().includes(club.clubName.toLowerCase()) || club.clubName.toLowerCase().includes(c.name.toLowerCase()));
          
          // filter out matches that are just common words like "FC" or "City" or "United"
          const meaningfulPartials = partialMatches.filter(c => {
             const cWords = c.name.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
             const clubWords = club.clubName.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
             return cWords.some(cw => clubWords.includes(cw));
          });

          if (meaningfulPartials.length > 0) {
            // If there's exactly 1 meaningful partial and it's extremely close, maybe auto-resolve later, but for now flag as ambiguous to be safe unless it's really a subset
            ambiguousClubs.add(`'${club.clubName}' (similar to: ${meaningfulPartials.map(c => c.name).join(', ')})`);
          } else {
            // genuinely new club
            const clubCountryId = resolveCountry(club.country);
            if (!clubCountryId) {
              unresolvedNationalities.add(`[Club] ${club.country}`);
            } else {
              newClubs.set(club.clubName, { country: clubCountryId });
            }
          }
        }
      }
    }
  }

  console.log('\n--- REPORT ---');
  console.log(`Total players found in JSON: ${players.length}`);
  console.log(`Potential duplicates that would be skipped: ${duplicatesSkipped}`);
  console.log(`\nUnresolvable Nationalities (${unresolvedNationalities.size}):`);
  unresolvedNationalities.forEach(n => console.log(`  - ${n}`));
  
  console.log(`\nAmbiguous Clubs (${ambiguousClubs.size}):`);
  let count = 0;
  for (const ac of ambiguousClubs) {
    if (count++ < 20) console.log(`  - ${ac}`);
  }
  if (ambiguousClubs.size > 20) console.log(`  ... and ${ambiguousClubs.size - 20} more`);

  console.log(`\nNew Clubs to Create (${newClubs.size}):`);
  count = 0;
  for (const [name, data] of newClubs.entries()) {
    if (count++ < 20) console.log(`  - ${name} (${data.country})`);
  }
  if (newClubs.size > 20) console.log(`  ... and ${newClubs.size - 20} more`);

}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
