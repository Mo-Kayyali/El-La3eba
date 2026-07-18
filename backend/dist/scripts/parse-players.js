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
async function main() {
    const dataPath = path.join(__dirname, '../../players.json');
    const players = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const countries = await prisma.country.findMany();
    const countryMap = new Map();
    for (const c of countries) {
        countryMap.set(normalize(c.name), c.id);
        countryMap.set(normalize(c.id), c.id);
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
        'north macedonia': 'MKD',
        'russia': 'RUS',
        'iran': 'IRN',
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
    const existingClubs = await prisma.club.findMany();
    const unresolvedNationalities = new Set();
    const ambiguousClubs = new Set();
    const newClubs = new Map();
    let duplicatesSkipped = 0;
    console.log(`Analyzing ${players.length} players...`);
    const existingPlayersMap = new Set();
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
                    const partialMatches = existingClubs.filter(c => c.name.toLowerCase().includes(club.clubName.toLowerCase()) || club.clubName.toLowerCase().includes(c.name.toLowerCase()));
                    const meaningfulPartials = partialMatches.filter(c => {
                        const cWords = c.name.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
                        const clubWords = club.clubName.toLowerCase().split(/\s+/).filter(w => !['fc', 'cf', 'united', 'city', 'real', 'ac', 'inter', 'sporting', 'de', 'cd'].includes(w));
                        return cWords.some(cw => clubWords.includes(cw));
                    });
                    if (meaningfulPartials.length > 0) {
                        ambiguousClubs.add(`'${club.clubName}' (similar to: ${meaningfulPartials.map(c => c.name).join(', ')})`);
                    }
                    else {
                        const clubCountryId = resolveCountry(club.country);
                        if (!clubCountryId) {
                            unresolvedNationalities.add(`[Club] ${club.country}`);
                        }
                        else {
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
        if (count++ < 20)
            console.log(`  - ${ac}`);
    }
    if (ambiguousClubs.size > 20)
        console.log(`  ... and ${ambiguousClubs.size - 20} more`);
    console.log(`\nNew Clubs to Create (${newClubs.size}):`);
    count = 0;
    for (const [name, data] of newClubs.entries()) {
        if (count++ < 20)
            console.log(`  - ${name} (${data.country})`);
    }
    if (newClubs.size > 20)
        console.log(`  ... and ${newClubs.size - 20} more`);
}
main()
    .catch(e => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=parse-players.js.map