import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function normalize(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const countryToCompetitionMap: Record<string, string> = {
  'USA': 'MLS',
  'ENG': 'Premier League',
  'ITA': 'Serie A',
  'ESP': 'La Liga',
  'GER': 'Bundesliga',
  'FRA': 'Ligue 1',
  'BRA': 'Campeonato Brasileiro Série A',
  'ARG': 'Argentine Primera División',
  'NLD': 'Eredivisie',
  'POR': 'Primeira Liga',
  'URY': 'Uruguayan Primera División',
  'BEL': 'Belgian First Division A',
  'POL': 'Ekstraklasa',
  'PER': 'Peruvian Primera División',
  'UKR': 'Ukrainian Premier League',
  'RUS': 'Russian Premier League',
  'HUN': 'Nemzeti Bajnokság I',
  'AUT': 'Austrian Football Bundesliga',
  'SCO': 'Scottish Premiership',
  'SWE': 'Allsvenskan',
  'COL': 'Categoría Primera A',
  'CHL': 'Chilean Primera División',
  'MEX': 'Liga MX',
  'JPN': 'J1 League',
  'KOR': 'K League 1',
  'SRB': 'Serbian SuperLiga',
  'CZE': 'Czech First League',
  'ROU': 'Liga I',
  'BGR': 'First Professional Football League',
  'TUR': 'Süper Lig',
  'GRC': 'Super League Greece',
  'CHE': 'Swiss Super League',
  'DNK': 'Danish Superliga',
  'NOR': 'Eliteserien',
  'PRY': 'Paraguayan Primera División',
  'ECU': 'Ecuadorian Serie A',
  'AUS': 'A-League',
  'HRV': 'Croatian Football League',
  'ZAF': 'Premier Soccer League',
  'EGY': 'Egyptian Premier League',
  'CMR': 'Elite One',
  'NGA': 'Nigeria Professional Football League',
  'GHA': 'Ghana Premier League',
  'CIV': 'Ligue 1 (Ivory Coast)',
  'MAR': 'Botola',
  'ALG': 'Algerian Ligue Professionnelle 1',
  'TUN': 'Tunisian Ligue Professionnelle 1',
  'SEN': 'Senegal Premier League',
  'IRN': 'Persian Gulf Pro League',
  'SAU': 'Saudi Pro League',
  'QAT': 'Qatar Stars League',
  'UAE': 'UAE Pro League',
  'CHN': 'Chinese Super League',
  'VEN': 'Venezuelan Primera División',
  'BOL': 'Bolivian Primera División',
  'CRI': 'Liga FPD',
  'SLV': 'Salvadoran Primera División',
  'HON': 'Liga Nacional de Honduras',
  'JAM': 'National Premier League',
  'CAN': 'Canadian Premier League',
  'WAL': 'Cymru Premier',
  'NIR': 'NIFL Premiership',
  'IRL': 'League of Ireland',
  'ISL': 'Úrvalsdeild karla',
  'FIN': 'Veikkausliiga',
  'SVK': 'Slovak First Football League',
  'SVN': 'Slovenian PrvaLiga',
  'BIH': 'Premier League of Bosnia and Herzegovina',
  'MKD': 'Macedonian First Football League',
  'MNE': 'Montenegrin First League',
  'ALB': 'Kategoria Superiore',
  'GEO': 'Erovnuli Liga',
  'ARM': 'Armenian Premier League',
  'AZE': 'Azerbaijan Premier League',
  'KAZ': 'Kazakhstan Premier League',
  'UZB': 'Uzbekistan Super League',
  'PRK': 'DPR Korea Premier Football League',
  'IDN': 'Liga 1',
  'MYS': 'Malaysia Super League',
  'THA': 'Thai League 1',
  'VNM': 'V.League 1',
  'IND': 'Indian Super League',
  'NZL': 'New Zealand Football Championship',
  'CUB': 'Campeonato Nacional de Fútbol de Cuba',
  'HTI': 'Ligue Haïtienne',
  'TTO': 'TT Pro League',
  'GUY': 'GFF Elite League',
  'GTM': 'Liga Nacional de Fútbol de Guatemala',
  'BEN': 'Championnat National du Bénin',
  'PAN': 'Liga Panameña de Fútbol'
};

const ambiguousResolutions: Record<string, string> = {
  'Independiente': 'CA Independiente',
  'Schalke 04': 'FC Schalke 04',
  '1899 Hoffenheim': 'TSG 1899 Hoffenheim'
};

async function main() {
  const dataPath = path.join(__dirname, '../../players.json');
  const players = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const countries = await prisma.country.findMany();
  const countryMap = new Map<string, { id: string, name: string }>(); 
  for (const c of countries) {
    countryMap.set(normalize(c.name), c);
    countryMap.set(normalize(c.id), c);
  }

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
    'germany': 'GER',
    'west germany': 'GER',
    'france': 'FRA',
    'brazil': 'BRA',
    'argentina': 'ARG',
    'portugal': 'POR',
    'uruguay': 'URY',
    'soviet union': 'RUS',
    'yugoslavia': 'SRB',
    'czechoslovakia': 'CZE',
    'ireland': 'IRL',
    'republic of ireland': 'IRL',
    'south korea': 'KOR',
    'republic of korea': 'KOR',
    'north macedonia': 'MKD',
    'macedonia': 'MKD',
    'russia': 'RUS',
    'russian federation': 'RUS',
    'iran': 'IRN',
    'islamic republic of iran': 'IRN',
    'venezuela': 'VEN'
  };

  const resolveCountry = (name: string) => {
    const norm = normalize(name);
    if (countryMap.has(norm)) return countryMap.get(norm)!;
    
    const lower = name.toLowerCase();
    if (countryAliases[lower] && countryMap.has(normalize(countryAliases[lower]))) {
      return countryMap.get(normalize(countryAliases[lower]))!;
    }
    return null;
  };

  const existingClubs = await prisma.club.findMany({ include: { country: true } });
  
  const skippedPlayersIsrael: string[] = [];
  const skippedClubsIsrael: string[] = [];
  const resolvedByCountryCrossCheck: string[] = [];
  const stillAmbiguous = new Set<string>();
  
  const newClubs = new Map<string, { countryId: string, countryName: string }>();
  const newCompetitions = new Map<string, { name: string, isReal: boolean, countryId: string, countryName: string }>();
  
  let playersReady = 0;
  let playerClubsReady = 0;
  
  for (const player of players) {
    const isIsrael = normalize(player.nationality) === 'israel';
    if (isIsrael) {
      skippedPlayersIsrael.push(player.name);
      continue;
    }

    const countryObj = resolveCountry(player.nationality);
    if (!countryObj) {
      continue;
    }

    playersReady++;

    if (player.clubs) {
      for (const club of player.clubs) {
        if (normalize(club.country) === 'israel') {
          skippedClubsIsrael.push(`${club.clubName} (for player ${player.name})`);
          continue;
        }

        const clubCountryObj = resolveCountry(club.country);
        if (!clubCountryObj) {
          continue;
        }

        // Apply manual ambiguous resolution first
        let targetClubName = club.clubName;
        if (ambiguousResolutions[targetClubName]) {
          targetClubName = ambiguousResolutions[targetClubName];
        }

        const cNorm = normalize(targetClubName);
        
        // a & b: Exact match on name or aliases
        const exactMatch = existingClubs.find(c => normalize(c.name) === cNorm || c.aliases.some(a => normalize(a) === cNorm));
        
        if (exactMatch) {
          playerClubsReady++;
          continue;
        }

        // c: Substring/fuzzy match
        const partialMatches = existingClubs.filter(c => c.name.toLowerCase().includes(targetClubName.toLowerCase()) || targetClubName.toLowerCase().includes(c.name.toLowerCase()));
        
        const meaningfulPartials = partialMatches.filter(c => {
           const cWords = c.name.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
           const clubWords = targetClubName.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
           return cWords.some(cw => clubWords.includes(cw)) || (cWords.length === 0 && clubWords.length === 0 && c.name.toLowerCase().includes(targetClubName.toLowerCase()));
        });

        if (meaningfulPartials.length > 0) {
          // filter by country
          const countryMatches = meaningfulPartials.filter(c => c.countryCode === clubCountryObj.id);
          
          if (countryMatches.length === 1) {
            resolvedByCountryCrossCheck.push(`'${targetClubName}' matched to -> ${countryMatches[0].name} (Country: ${clubCountryObj.name})`);
            playerClubsReady++;
          } else if (countryMatches.length > 1) {
            stillAmbiguous.add(`'${targetClubName}' (multiple matches in ${clubCountryObj.name}: ${countryMatches.map(c => c.name).join(', ')})`);
          } else {
            // No matches in the correct country, treat as new club
            newClubs.set(targetClubName, { countryId: clubCountryObj.id, countryName: clubCountryObj.name });
            playerClubsReady++;
          }
        } else {
          // New club
          newClubs.set(targetClubName, { countryId: clubCountryObj.id, countryName: clubCountryObj.name });
          playerClubsReady++;
        }
      }
    }
  }

  for (const [name, data] of newClubs.entries()) {
    const compName = countryToCompetitionMap[data.countryId];
    if (compName) {
      newCompetitions.set(data.countryId, { name: compName, isReal: true, countryId: data.countryId, countryName: data.countryName });
    } else {
      newCompetitions.set(data.countryId, { name: `${data.countryName} - Unspecified Top Division`, isReal: false, countryId: data.countryId, countryName: data.countryName });
    }
  }

  console.log('\n--- REPORT ---');
  console.log(`Players skipped due to Israel nationality: ${skippedPlayersIsrael.length}`);
  if (skippedPlayersIsrael.length > 0) console.log(`  - ${skippedPlayersIsrael.join(', ')}`);
  
  console.log(`\nClubs skipped due to Israel country: ${skippedClubsIsrael.length}`);
  if (skippedClubsIsrael.length > 0) console.log(`  - ${skippedClubsIsrael.join(', ')}`);

  console.log(`\nStill Ambiguous Clubs (${stillAmbiguous.size}):`);
  for (const ac of stillAmbiguous) {
    console.log(`  - ${ac}`);
  }

  console.log(`\nNew Competitions to Create (${newCompetitions.size}):`);
  for (const comp of newCompetitions.values()) {
    console.log(`  - ${comp.name} [${comp.isReal ? 'REAL' : 'PLACEHOLDER'}] (${comp.countryName})`);
  }

  console.log(`\nFINAL TOTALS:`);
  console.log(`  - Players ready to insert: ${playersReady}`);
  console.log(`  - PlayerClub rows ready to insert: ${playerClubsReady}`);
  console.log(`  - New Clubs ready to create: ${newClubs.size}`);
  console.log(`  - New Competitions ready to create: ${newCompetitions.size}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
