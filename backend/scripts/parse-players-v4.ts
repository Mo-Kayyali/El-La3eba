import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function normalize(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const countryToCompetitionMap: Record<string, string> = {
  'USA': 'Major League Soccer',
  'ENG': 'Premier League',
  'ITA': 'Serie A',
  'ESP': 'LaLiga',
  'GER': 'Bundesliga',
  'FRA': 'Ligue 1',
  'BRA': 'Campeonato Brasileiro Série A',
  'ARG': 'Torneo Clausura',
  'NLD': 'Eredivisie',
  'POR': 'Liga Portugal',
  'URY': 'Uruguayan Primera División',
  'BEL': 'Jupiler Pro League',
  'POL': 'Ekstraklasa',
  'PER': 'Peruvian Primera División',
  'UKR': 'Ukrainian Premier League',
  'RUS': 'Russian Premier League',
  'HUN': 'Nemzeti Bajnokság I',
  'AUT': 'Austrian Football Bundesliga',
  'SCO': 'Scottish Premiership',
  'SWE': 'Allsvenskan',
  'COL': 'Categoría Primera A',
  'CHL': 'Primera División',
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
  'SAU': 'Roshn Saudi League',
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
  const existingComps = await prisma.competition.findMany();
  
  const skippedPlayersIsrael: string[] = [];
  const skippedClubsIsrael: string[] = [];
  const resolvedByCountryCrossCheck: string[] = [];
  const stillAmbiguous = new Set<string>();
  
  const newClubs = new Map<string, { countryId: string, countryName: string }>();
  const reusedCompetitions: any[] = [];
  const newlyCreatedCompetitions: any[] = [];
  
  let playersReady = 0;
  let playerClubsReady = 0;
  
  // Collect all distinct proposed competitions first
  const proposedCompsSet = new Set<string>(); // unique country IDs
  
  for (const player of players) {
    const isIsrael = normalize(player.nationality) === 'israel';
    if (isIsrael) {
      skippedPlayersIsrael.push(player.name);
      continue;
    }

    const countryObj = resolveCountry(player.nationality);
    if (!countryObj) continue;

    playersReady++;

    if (player.clubs) {
      for (const club of player.clubs) {
        if (normalize(club.country) === 'israel') {
          skippedClubsIsrael.push(`${club.clubName} (for player ${player.name})`);
          continue;
        }

        const clubCountryObj = resolveCountry(club.country);
        if (!clubCountryObj) continue;

        let targetClubName = club.clubName;
        if (ambiguousResolutions[targetClubName]) {
          targetClubName = ambiguousResolutions[targetClubName];
        }

        const cNorm = normalize(targetClubName);
        const exactMatch = existingClubs.find(c => normalize(c.name) === cNorm || c.aliases.some(a => normalize(a) === cNorm));
        
        if (exactMatch) {
          playerClubsReady++;
          continue;
        }

        const partialMatches = existingClubs.filter(c => c.name.toLowerCase().includes(targetClubName.toLowerCase()) || targetClubName.toLowerCase().includes(c.name.toLowerCase()));
        const meaningfulPartials = partialMatches.filter(c => {
           const cWords = c.name.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
           const clubWords = targetClubName.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
           return cWords.some(cw => clubWords.includes(cw)) || (cWords.length === 0 && clubWords.length === 0 && c.name.toLowerCase().includes(targetClubName.toLowerCase()));
        });

        if (meaningfulPartials.length > 0) {
          const countryMatches = meaningfulPartials.filter(c => c.countryCode === clubCountryObj.id);
          if (countryMatches.length === 1) {
            resolvedByCountryCrossCheck.push(`'${targetClubName}' matched to -> ${countryMatches[0].name} (Country: ${clubCountryObj.name})`);
            playerClubsReady++;
          } else if (countryMatches.length > 1) {
            stillAmbiguous.add(`'${targetClubName}' (multiple matches in ${clubCountryObj.name}: ${countryMatches.map(c => c.name).join(', ')})`);
          } else {
            newClubs.set(targetClubName, { countryId: clubCountryObj.id, countryName: clubCountryObj.name });
            proposedCompsSet.add(clubCountryObj.id);
            playerClubsReady++;
          }
        } else {
          newClubs.set(targetClubName, { countryId: clubCountryObj.id, countryName: clubCountryObj.name });
          proposedCompsSet.add(clubCountryObj.id);
          playerClubsReady++;
        }
      }
    }
  }

  // Cross check proposed competitions against existing ones
  for (const countryId of proposedCompsSet) {
    const proposedName = countryToCompetitionMap[countryId] || `Unspecified Top Division`;
    const compsInCountry = existingComps.filter(c => c.countryCode === countryId);
    
    let matchedComp: any = null;
    const pNorm = normalize(proposedName);

    // 1. Exact match or Exact normalized match
    matchedComp = compsInCountry.find(c => c.name === proposedName || normalize(c.name) === pNorm);
    
    // 2. Fuzzy match
    if (!matchedComp) {
      // Examples: "Major League Soccer" matches "MLS", "Spanish Primera División" matches "La Liga", "Ligue 1" matches "Ligue 1 Uber Eats"
      for (const c of compsInCountry) {
        const cNorm = normalize(c.name);
        // check substring both ways
        if (cNorm.includes(pNorm) || pNorm.includes(cNorm)) {
          matchedComp = c;
          break;
        }
        // Specific hardcodes to help fuzzy matching where abbreviations or alternative names are used
        if ((cNorm === normalize('Major League Soccer') && pNorm === normalize('MLS')) || (cNorm === normalize('MLS') && pNorm === normalize('Major League Soccer'))) matchedComp = c;
        if ((cNorm.includes('primera') && pNorm.includes('laliga')) || (cNorm.includes('laliga') && pNorm.includes('primera'))) matchedComp = c;
        if ((cNorm.includes('premierleague') && pNorm.includes('premierleague'))) matchedComp = c;
        if ((cNorm.includes('seriea') && pNorm.includes('seriea'))) matchedComp = c;
        if ((cNorm.includes('bundesliga') && pNorm.includes('bundesliga'))) matchedComp = c;
        if ((cNorm.includes('ligue1') && pNorm.includes('ligue1'))) matchedComp = c;
        
        if (matchedComp) break;
      }
    }

    if (matchedComp) {
      reusedCompetitions.push({ proposed: proposedName, existing: matchedComp.name, id: matchedComp.id, country: countryId });
    } else {
      newlyCreatedCompetitions.push({ name: proposedName, country: countryId });
    }
  }

  console.log('\n--- REPORT ---');
  
  console.log(`\nCOMPETITIONS ALREADY EXISTING (Will be reused - ${reusedCompetitions.length}):`);
  for (const rc of reusedCompetitions) {
    console.log(`  - Proposed: "${rc.proposed}" => Reusing existing: "${rc.existing}" (ID: ${rc.id})`);
  }

  console.log(`\nGENUINELY NEW COMPETITIONS TO CREATE (${newlyCreatedCompetitions.length}):`);
  for (const nc of newlyCreatedCompetitions) {
    console.log(`  - "${nc.name}" (Country: ${nc.country})`);
  }

  console.log(`\nFINAL TOTALS:`);
  console.log(`  - Players ready to insert: ${playersReady}`);
  console.log(`  - PlayerClub rows ready to insert: ${playerClubsReady}`);
  console.log(`  - New Clubs ready to create: ${newClubs.size}`);
  console.log(`  - New Competitions actually ready to create: ${newlyCreatedCompetitions.length}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
