import { PrismaClient, PositionCategory } from '@prisma/client';
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

async function main() {
  const dataPath = path.join(__dirname, '../../players.json');
  const players = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  const countries = await prisma.country.findMany();
  const countryMap = new Map<string, { id: string, name: string }>(); 
  for (const c of countries) {
    countryMap.set(normalize(c.name), c);
    countryMap.set(normalize(c.id), c);
  }

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
  
  const proposedCompsSet = new Set<string>(); // unique country IDs
  
  console.log('Resolving entities...');
  for (const player of players) {
    if (normalize(player.nationality) === 'israel') continue;

    const countryObj = resolveCountry(player.nationality);
    if (!countryObj) continue;

    if (player.clubs) {
      for (const club of player.clubs) {
        if (normalize(club.country) === 'israel') continue;
        const clubCountryObj = resolveCountry(club.country);
        if (!clubCountryObj) continue;

        let targetClubName = club.clubName;
        if (ambiguousResolutions[targetClubName]) {
          targetClubName = ambiguousResolutions[targetClubName];
        }

        const cNorm = normalize(targetClubName);
        const exactMatch = existingClubs.find(c => normalize(c.name) === cNorm || c.aliases.some(a => normalize(a) === cNorm));
        
        if (exactMatch) continue;

        const partialMatches = existingClubs.filter(c => c.name.toLowerCase().includes(targetClubName.toLowerCase()) || targetClubName.toLowerCase().includes(c.name.toLowerCase()));
        const meaningfulPartials = partialMatches.filter(c => {
           const cWords = c.name.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
           const clubWords = targetClubName.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
           return cWords.some(cw => clubWords.includes(cw)) || (cWords.length === 0 && clubWords.length === 0 && c.name.toLowerCase().includes(targetClubName.toLowerCase()));
        });

        if (meaningfulPartials.length > 0) {
          const countryMatches = meaningfulPartials.filter(c => c.countryCode === clubCountryObj.id);
          if (countryMatches.length !== 1) {
            proposedCompsSet.add(clubCountryObj.id);
          }
        } else {
          proposedCompsSet.add(clubCountryObj.id);
        }
      }
    }
  }

  console.log('Creating genuinely new competitions...');
  const newCompMap = new Map<string, any>(); // countryCode -> Competition
  
  for (const countryId of proposedCompsSet) {
    const proposedName = countryToCompetitionMap[countryId] || `Unspecified Top Division`;
    const compsInCountry = existingComps.filter(c => c.countryCode === countryId);
    
    let matchedComp: any = null;
    const pNorm = normalize(proposedName);

    matchedComp = compsInCountry.find(c => c.name === proposedName || normalize(c.name) === pNorm);
    
    if (!matchedComp) {
      for (const c of compsInCountry) {
        const cNorm = normalize(c.name);
        if (cNorm.includes(pNorm) || pNorm.includes(cNorm)) {
          matchedComp = c; break;
        }
        if ((cNorm === normalize('Major League Soccer') && pNorm === normalize('MLS')) || (cNorm === normalize('MLS') && pNorm === normalize('Major League Soccer'))) matchedComp = c;
        if ((cNorm.includes('primera') && pNorm.includes('laliga')) || (cNorm.includes('laliga') && pNorm.includes('primera'))) matchedComp = c;
        if ((cNorm.includes('premierleague') && pNorm.includes('premierleague'))) matchedComp = c;
        if ((cNorm.includes('seriea') && pNorm.includes('seriea'))) matchedComp = c;
        if ((cNorm.includes('bundesliga') && pNorm.includes('bundesliga'))) matchedComp = c;
        if ((cNorm.includes('ligue1') && pNorm.includes('ligue1'))) matchedComp = c;
        if (matchedComp) break;
      }
    }

    if (!matchedComp) {
      // Create new competition
      matchedComp = await prisma.competition.create({
        data: {
          name: proposedName,
          type: 'DOMESTIC_LEAGUE',
          countryCode: countryId,
          tier: 1
        }
      });
      existingComps.push(matchedComp); // add to in-memory list
      console.log(`  -> Created competition: ${proposedName} (${countryId})`);
    }
    
    newCompMap.set(countryId, matchedComp);
  }

  console.log('Inserting clubs and players...');
  let playersInserted = 0;
  let playerClubsInserted = 0;
  let clubsCreated = 0;

  for (const player of players) {
    if (normalize(player.nationality) === 'israel') continue;

    const countryObj = resolveCountry(player.nationality);
    if (!countryObj) continue;

    // determine position category
    const pcMap: Record<string, PositionCategory> = {
      'forward': 'FORWARD',
      'midfielder': 'MIDFIELDER',
      'defender': 'DEFENDER',
      'goalkeeper': 'GOALKEEPER'
    };
    const pPos = player.primaryPosition ? pcMap[player.primaryPosition.toLowerCase()] : null;

    // DOB parsing
    let dob: Date | null = null;
    if (player.dateOfBirth && player.dateOfBirth.length >= 4) {
       dob = new Date(player.dateOfBirth);
    }

    // Insert Player
    const newPlayer = await prisma.player.create({
      data: {
        firstName: player.firstName || '',
        lastName: player.lastName || '',
        name: player.name || player.lastName,
        aliases: player.aliases || [],
        nationality: countryObj.id,
        dateOfBirth: dob,
        isRetired: true,
        positionCategories: pPos ? [pPos] : []
      }
    });
    playersInserted++;

    if (player.clubs) {
      for (const club of player.clubs) {
        if (normalize(club.country) === 'israel') continue;
        const clubCountryObj = resolveCountry(club.country);
        if (!clubCountryObj) continue;

        let targetClubName = club.clubName;
        if (ambiguousResolutions[targetClubName]) {
          targetClubName = ambiguousResolutions[targetClubName];
        }

        // Find existing club
        let exactMatch = existingClubs.find(c => normalize(c.name) === normalize(targetClubName) || c.aliases.some(a => normalize(a) === normalize(targetClubName)));
        
        if (!exactMatch) {
          const partialMatches = existingClubs.filter(c => c.name.toLowerCase().includes(targetClubName.toLowerCase()) || targetClubName.toLowerCase().includes(c.name.toLowerCase()));
          const meaningfulPartials = partialMatches.filter(c => {
            const cWords = c.name.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
            const clubWords = targetClubName.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
            return cWords.some(cw => clubWords.includes(cw)) || (cWords.length === 0 && clubWords.length === 0 && c.name.toLowerCase().includes(targetClubName.toLowerCase()));
          });

          if (meaningfulPartials.length > 0) {
            const countryMatches = meaningfulPartials.filter(c => c.countryCode === clubCountryObj.id);
            if (countryMatches.length === 1) {
              exactMatch = countryMatches[0];
            }
          }
        }

        // Create club if it still doesn't exist
        if (!exactMatch) {
           const comp = newCompMap.get(clubCountryObj.id) || existingComps.find(c => c.countryCode === clubCountryObj.id && c.tier === 1);
           exactMatch = await prisma.club.create({
             data: {
               name: targetClubName,
               countryCode: clubCountryObj.id,
               currentCompetitionId: comp ? comp.id : null
             }
           });
           existingClubs.push(exactMatch);
           clubsCreated++;
           
           if (comp) {
             await prisma.clubCompetition.create({
               data: { clubId: exactMatch.id, competitionId: comp.id }
             });
           }
        }

        // Parse years
        let sYear = null;
        let eYear = null;
        if (club.approxYears) {
           const parts = club.approxYears.split('-');
           if (parts.length > 0) {
              const y1 = parseInt(parts[0].trim());
              if (!isNaN(y1)) sYear = y1;
           }
           if (parts.length > 1) {
              const y2 = parseInt(parts[1].trim());
              if (!isNaN(y2)) eYear = y2;
           }
        }

        // Insert PlayerClub
        await prisma.playerClub.create({
          data: {
            playerId: newPlayer.id,
            clubId: exactMatch.id,
            startYear: sYear,
            endYear: eYear,
            isCurrent: false
          }
        });
        playerClubsInserted++;
      }
    }
  }

  console.log('\n--- FINAL RUN REPORT ---');
  console.log(`Total New Competitions created: ${newCompMap.size > 0 ? (existingComps.length - (await prisma.competition.count())) * -1 : 0}`); 
  // accurate counts:
  console.log(`Players Inserted: ${playersInserted}`);
  console.log(`PlayerClubs Inserted: ${playerClubsInserted}`);
  console.log(`Clubs Created: ${clubsCreated}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
