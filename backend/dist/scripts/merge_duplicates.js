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
        await this.prisma.player.update({
            where: { id: playerId },
            data: {
                clubs: clubs,
                competitions: Array.from(competitions)
            }
        });
    }
}
const prisma = new client_1.PrismaClient();
const playerDenorm = new DummyPlayerDenormService(prisma);
async function main() {
    const dataDir = path.resolve(__dirname, '../../');
    const mergePath = path.join(dataDir, 'duplicate_players_to_merge.json');
    if (!fs.existsSync(mergePath)) {
        console.error('Merge file not found');
        return;
    }
    const mergeData = JSON.parse(fs.readFileSync(mergePath, 'utf-8'));
    const pairs = mergeData.duplicates || [];
    let mergedCount = 0;
    for (const pair of pairs) {
        const p1Id = pair.player1.id;
        const p2Id = pair.player2.id;
        const p1Exists = await prisma.player.findUnique({ where: { id: p1Id } });
        const p2Exists = await prisma.player.findUnique({ where: { id: p2Id } });
        if (!p1Exists || !p2Exists) {
            console.log(`Skipping pair ${pair.player1.name} - one or both players already deleted/merged.`);
            continue;
        }
        const p1Clubs = await prisma.playerClub.findMany({ where: { playerId: p1Id } });
        const p2Clubs = await prisma.playerClub.findMany({ where: { playerId: p2Id } });
        let primaryId = p1Id;
        let secondaryId = p2Id;
        let secondaryClubs = p2Clubs;
        let primaryClubs = p1Clubs;
        if (p2Clubs.length > p1Clubs.length) {
            primaryId = p2Id;
            secondaryId = p1Id;
            secondaryClubs = p1Clubs;
            primaryClubs = p2Clubs;
        }
        for (const sc of secondaryClubs) {
            const exists = primaryClubs.find(pc => pc.clubId === sc.clubId);
            if (!exists) {
                await prisma.playerClub.update({
                    where: { id: sc.id },
                    data: { playerId: primaryId }
                });
                primaryClubs.push(sc);
            }
            else {
                await prisma.playerClub.delete({
                    where: { id: sc.id }
                });
            }
        }
        await prisma.player.delete({
            where: { id: secondaryId }
        });
        await playerDenorm.regenerateForPlayer(primaryId);
        console.log(`Merged player ${pair.player1.name} (kept ${primaryId === p1Id ? 'player1' : 'player2'})`);
        mergedCount++;
    }
    console.log(`Successfully merged ${mergedCount} players.`);
    fs.unlinkSync(mergePath);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=merge_duplicates.js.map