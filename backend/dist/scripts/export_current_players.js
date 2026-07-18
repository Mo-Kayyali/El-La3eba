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
const positionMap = {
    GK: 'Goalkeeper',
    RB: 'Defender',
    CB: 'Defender',
    LB: 'Defender',
    RWB: 'Defender',
    LWB: 'Defender',
    CDM: 'Midfielder',
    CM: 'Midfielder',
    CAM: 'Midfielder',
    RM: 'Midfielder',
    LM: 'Midfielder',
    RW: 'Forward',
    LW: 'Forward',
    CF: 'Forward',
    ST: 'Forward'
};
async function main() {
    const countries = await prisma.country.findMany();
    const countryMap = new Map(countries.map(c => [c.id, c.name]));
    const clubs = await prisma.club.findMany();
    const clubMap = new Map(clubs.map(c => [c.id, c]));
    const players = await prisma.player.findMany({
        where: { isRetired: false }
    });
    const playerIds = players.map(p => p.id);
    const playerClubs = await prisma.playerClub.findMany({
        where: { playerId: { in: playerIds } }
    });
    const playerClubsMap = new Map();
    for (const pc of playerClubs) {
        if (!playerClubsMap.has(pc.playerId)) {
            playerClubsMap.set(pc.playerId, []);
        }
        playerClubsMap.get(pc.playerId).push(pc);
    }
    const result = players.map(player => {
        const pClubs = playerClubsMap.get(player.id) || [];
        pClubs.sort((a, b) => {
            const aStart = a.startYear || 0;
            const bStart = b.startYear || 0;
            return aStart - bStart;
        });
        const formattedClubs = pClubs.map(pc => {
            const club = clubMap.get(pc.clubId);
            let approxYears = '';
            if (pc.startYear && pc.endYear) {
                approxYears = `${pc.startYear}-${pc.endYear}`;
            }
            else if (pc.startYear && pc.isCurrent) {
                approxYears = `${pc.startYear}-present`;
            }
            else if (pc.startYear) {
                approxYears = `${pc.startYear}`;
            }
            else if (pc.endYear) {
                approxYears = `-${pc.endYear}`;
            }
            else if (pc.isCurrent) {
                approxYears = 'present';
            }
            return {
                clubName: club ? club.name : 'Unknown Club',
                country: club ? (countryMap.get(club.countryCode) || club.countryCode) : 'Unknown',
                approxYears: approxYears
            };
        });
        return {
            firstName: player.firstName,
            lastName: player.lastName,
            name: player.name,
            aliases: player.aliases,
            nationality: countryMap.get(player.nationality) || player.nationality,
            dateOfBirth: player.dateOfBirth ? player.dateOfBirth.toISOString().split('T')[0] : null,
            primaryPosition: player.primaryPosition ? (positionMap[player.primaryPosition] || player.primaryPosition) : null,
            clubs: formattedClubs
        };
    });
    const outPath = path.resolve(__dirname, '..', '..', 'currentplayers.json');
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`Exported ${result.length} players to ${outPath}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=export_current_players.js.map