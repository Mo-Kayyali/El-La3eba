"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const prisma = new client_1.PrismaClient();
function normalize(str) {
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}
const countryToCompetitionMap = {
    'USA': 'North American Soccer League (NASL) / MLS',
    'ENG': 'English First Division / Premier League',
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
    'UKR': 'Soviet Top League / Ukrainian Premier League',
    'RUS': 'Soviet Top League / Russian Premier League',
    'HUN': 'Nemzeti Bajnokság I',
    'AUT': 'Austrian Football Bundesliga',
    'SCO': 'Scottish First Division / Premiership',
    'SWE': 'Allsvenskan',
    'COL': 'Categoría Primera A',
    'CHL': 'Chilean Primera División',
    'MEX': 'Liga MX',
    'JPN': 'JSL / J1 League',
    'KOR': 'K League 1',
    'SRB': 'Yugoslav First League / Serbian SuperLiga',
    'CZE': 'Czechoslovak First League / Czech First League',
    'ROU': 'Liga I',
    'BGR': 'A Group / First Professional Football League',
    'TUR': 'Süper Lig',
    'GRC': 'Alpha Ethniki / Super League Greece',
    'CHE': 'Nationalliga A / Swiss Super League',
    'DNK': 'Danish 1st Division / Superliga',
    'NOR': '1. divisjon / Eliteserien',
    'PRY': 'Paraguayan Primera División',
    'ECU': 'Ecuadorian Serie A',
    'AUS': 'National Soccer League / A-League',
    'HRV': 'Yugoslav First League / Croatian Football League',
    'ZAF': 'National Premier Soccer League / Premier Soccer League',
    'EGY': 'Egyptian Premier League',
    'CMR': 'Elite One',
    'NGA': 'Nigeria Professional Football League',
    'GHA': 'Ghana Premier League',
    'CIV': 'Ligue 1 (Ivory Coast)',
    'MAR': 'Botola',
    'ALG': 'Algerian Ligue Professionnelle 1',
    'TUN': 'Tunisian Ligue Professionnelle 1',
    'SEN': 'Senegal Premier League',
    'IRN': 'Takht Jamshid Cup / Persian Gulf Pro League',
    'SAU': 'Saudi Pro League',
    'QAT': 'Qatar Stars League',
    'UAE': 'UAE Pro League',
    'CHN': 'Jia-A League / Chinese Super League',
    'VEN': 'Venezuelan Primera División',
    'BOL': 'Bolivian Primera División',
    'CRI': 'Liga FPD',
    'SLV': 'Salvadoran Primera División',
    'HON': 'Liga Nacional de Honduras',
    'JAM': 'National Premier League',
    'CAN': 'CSL / Canadian Premier League',
    'WAL': 'Cymru Premier',
    'NIR': 'NIFL Premiership',
    'IRL': 'League of Ireland',
    'ISL': 'Úrvalsdeild karla',
    'FIN': 'Mestaruussarja / Veikkausliiga',
    'SVK': 'Czechoslovak First League / Slovak First Football League',
    'SVN': 'Yugoslav First League / Slovenian PrvaLiga',
    'BIH': 'Yugoslav First League / Premier League of Bosnia and Herzegovina',
    'MKD': 'Yugoslav First League / Macedonian First Football League',
    'MNE': 'Yugoslav First League / Montenegrin First League',
    'ALB': 'Kategoria Superiore',
    'GEO': 'Soviet Top League / Erovnuli Liga',
    'ARM': 'Soviet Top League / Armenian Premier League',
    'AZE': 'Soviet Top League / Azerbaijan Premier League',
    'KAZ': 'Soviet Top League / Kazakhstan Premier League',
    'UZB': 'Soviet Top League / Uzbekistan Super League',
    'PRK': 'DPR Korea Premier Football League',
    'IDN': 'Perserikatan / Liga 1',
    'MYS': 'Malaysia Super League',
    'THA': 'Thai League 1',
    'VNM': 'V.League 1',
    'IND': 'National Football League / Indian Super League',
    'NZL': 'New Zealand National Soccer League / New Zealand Football Championship',
    'CUB': 'Campeonato Nacional de Fútbol de Cuba',
    'HTI': 'Ligue Haïtienne',
    'TTO': 'TT Pro League',
    'GUY': 'GFF Elite League',
    'GTM': 'Liga Nacional de Fútbol de Guatemala',
    'BEN': 'Championnat National du Bénin',
    'PAN': 'Liga Panameña de Fútbol'
};
async function main() {
    const dataPath = path.join(__dirname, '../../players.json');
    const players = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const countries = await prisma.country.findMany();
    const countryMap = new Map();
    for (const c of countries) {
        countryMap.set(normalize(c.name), c);
        countryMap.set(normalize(c.id), c);
    }
    const countryAliases = {
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
    const resolveCountry = (name) => {
        const norm = normalize(name);
        if (countryMap.has(norm))
            return countryMap.get(norm);
        const lower = name.toLowerCase();
        if (countryAliases[lower] && countryMap.has(normalize(countryAliases[lower]))) {
            return countryMap.get(normalize(countryAliases[lower]));
        }
        return null;
    };
    const existingClubs = await prisma.club.findMany({ include: { country: true } });
    const skippedPlayersIsrael = [];
    const skippedClubsIsrael = [];
    const resolvedByCountryCrossCheck = [];
    const stillAmbiguous = new Set();
    const newClubs = new Map();
    const newCompetitions = new Map();
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
                const cNorm = normalize(club.clubName);
                const exactMatch = existingClubs.find(c => normalize(c.name) === cNorm || c.aliases.some(a => normalize(a) === cNorm));
                if (exactMatch) {
                    playerClubsReady++;
                    continue;
                }
                const partialMatches = existingClubs.filter(c => c.name.toLowerCase().includes(club.clubName.toLowerCase()) || club.clubName.toLowerCase().includes(c.name.toLowerCase()));
                const meaningfulPartials = partialMatches.filter(c => {
                    const cWords = c.name.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
                    const clubWords = club.clubName.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
                    return cWords.some(cw => clubWords.includes(cw)) || (cWords.length === 0 && clubWords.length === 0 && c.name.toLowerCase().includes(club.clubName.toLowerCase()));
                });
                if (meaningfulPartials.length > 0) {
                    const countryMatches = meaningfulPartials.filter(c => c.countryCode === clubCountryObj.id);
                    if (countryMatches.length === 1) {
                        resolvedByCountryCrossCheck.push(`'${club.clubName}' matched to -> ${countryMatches[0].name} (Country: ${clubCountryObj.name})`);
                        playerClubsReady++;
                    }
                    else if (countryMatches.length > 1) {
                        stillAmbiguous.add(`'${club.clubName}' (multiple matches in ${clubCountryObj.name}: ${countryMatches.map(c => c.name).join(', ')})`);
                    }
                    else {
                        newClubs.set(club.clubName, { countryId: clubCountryObj.id, countryName: clubCountryObj.name });
                        playerClubsReady++;
                    }
                }
                else {
                    newClubs.set(club.clubName, { countryId: clubCountryObj.id, countryName: clubCountryObj.name });
                    playerClubsReady++;
                }
            }
        }
    }
    for (const [name, data] of newClubs.entries()) {
        const compName = countryToCompetitionMap[data.countryId];
        if (compName) {
            newCompetitions.set(data.countryId, { name: compName, isReal: true, countryId: data.countryId, countryName: data.countryName });
        }
        else {
            newCompetitions.set(data.countryId, { name: `${data.countryName} - Unspecified Top Division`, isReal: false, countryId: data.countryId, countryName: data.countryName });
        }
    }
    console.log('\n--- REPORT ---');
    console.log(`Players skipped due to Israel nationality: ${skippedPlayersIsrael.length}`);
    if (skippedPlayersIsrael.length > 0)
        console.log(`  - ${skippedPlayersIsrael.join(', ')}`);
    console.log(`\nClubs skipped due to Israel country: ${skippedClubsIsrael.length}`);
    if (skippedClubsIsrael.length > 0)
        console.log(`  - ${skippedClubsIsrael.join(', ')}`);
    console.log(`\nAmbiguous Clubs Resolved by Country (${resolvedByCountryCrossCheck.length}):`);
    for (let i = 0; i < Math.min(20, resolvedByCountryCrossCheck.length); i++) {
        console.log(`  - ${resolvedByCountryCrossCheck[i]}`);
    }
    if (resolvedByCountryCrossCheck.length > 20)
        console.log(`  ... and ${resolvedByCountryCrossCheck.length - 20} more`);
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
//# sourceMappingURL=parse-players-v2.js.map