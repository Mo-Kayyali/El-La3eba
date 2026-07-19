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
class DummyPlayerDenormService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async regenerateForPlayer(playerId) {
        const playerClubs = await this.prisma.playerClub.findMany({
            where: { playerId },
            include: { club: true }
        });
        const clubs = Array.from(new Set(playerClubs.map((pc) => pc.club.name)));
        let competitions = new Set();
        for (const pc of playerClubs) {
            if (pc.club.competitions) {
                pc.club.competitions.forEach((c) => competitions.add(c));
            }
        }
        const currentClub = playerClubs.find((pc) => pc.isCurrent);
        await this.prisma.player.update({
            where: { id: playerId },
            data: {
                clubs: clubs,
                competitions: Array.from(competitions),
                currentClubId: currentClub ? currentClub.clubId : null,
            }
        });
    }
}
const prisma = new client_1.PrismaClient();
const playerDenorm = new DummyPlayerDenormService(prisma);
async function main() {
    const dataDir = path.resolve(__dirname, '../../');
    const auditPath = path.join(dataDir, 'player_audit_report.json');
    if (!fs.existsSync(auditPath)) {
        console.error('Audit file not found');
        return;
    }
    let unkCountry = await prisma.country.findUnique({ where: { id: 'UNK' } });
    if (!unkCountry) {
        unkCountry = await prisma.country.create({ data: { id: 'UNK', name: 'Unknown' } });
    }
    const players = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    let updatedCount = 0;
    for (const p of players) {
        if (!p.clubHistory || p.clubHistory.length === 0)
            continue;
        const dbPlayer = await prisma.player.findUnique({ where: { id: p.id } });
        if (!dbPlayer)
            continue;
        const existingPcs = await prisma.playerClub.findMany({ where: { playerId: p.id } });
        let addedAny = false;
        for (const ch of p.clubHistory) {
            if (!ch.clubName)
                continue;
            let startYear = null;
            let endYear = null;
            let isCurrent = false;
            if (ch.approxYears) {
                const parts = ch.approxYears.split('-');
                if (parts.length === 2) {
                    startYear = parseInt(parts[0], 10) || null;
                    if (parts[1].toLowerCase() === 'present') {
                        isCurrent = true;
                    }
                    else {
                        endYear = parseInt(parts[1], 10) || null;
                    }
                }
                else if (parts.length === 1) {
                    startYear = parseInt(parts[0], 10) || null;
                }
            }
            let club = await prisma.club.findFirst({
                where: { name: { equals: ch.clubName, mode: 'insensitive' } }
            });
            if (!club) {
                club = await prisma.club.create({
                    data: {
                        name: ch.clubName,
                        countryCode: 'UNK'
                    }
                });
            }
            const alreadyHas = existingPcs.find(pc => pc.clubId === club.id && pc.startYear === startYear);
            if (!alreadyHas) {
                const justAdded = await prisma.playerClub.findFirst({
                    where: { playerId: p.id, clubId: club.id, startYear }
                });
                if (!justAdded) {
                    await prisma.playerClub.create({
                        data: {
                            playerId: p.id,
                            clubId: club.id,
                            startYear,
                            endYear,
                            isCurrent
                        }
                    });
                    addedAny = true;
                }
            }
        }
        if (addedAny) {
            await playerDenorm.regenerateForPlayer(p.id);
            updatedCount++;
            if (updatedCount % 50 === 0)
                console.log(`Processed ${updatedCount} players...`);
        }
    }
    console.log(`Successfully updated clubs for ${updatedCount} players.`);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=apply_enriched_clubs.js.map