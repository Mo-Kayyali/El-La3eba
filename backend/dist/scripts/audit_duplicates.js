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
async function main() {
    console.log('Finding duplicate players via pg_trgm similarity...');
    console.log('This may take a few seconds as it compares all pairs...');
    const duplicates = await prisma.$queryRawUnsafe(`
    SELECT 
      p1.id as id1, p1.name as name1, p1."currentClubId" as "currentClubId1", p1."nationality" as nationality1,
      p2.id as id2, p2.name as name2, p2."currentClubId" as "currentClubId2", p2."nationality" as nationality2,
      GREATEST(
        similarity(p1.name, p2.name),
        word_similarity(p1.name, p2.name),
        word_similarity(p2.name, p1.name)
      ) as sim_score
    FROM "Player" p1
    JOIN "Player" p2 ON p1.id < p2.id
    WHERE similarity(p1.name, p2.name) >= 0.75
       OR word_similarity(p1.name, p2.name) >= 0.85
       OR word_similarity(p2.name, p1.name) >= 0.85
    ORDER BY sim_score DESC
  `);
    const reportData = [];
    for (const pair of duplicates) {
        const pc1 = await prisma.playerClub.findMany({ where: { playerId: pair.id1 }, include: { club: true } });
        const pc2 = await prisma.playerClub.findMany({ where: { playerId: pair.id2 }, include: { club: true } });
        reportData.push({
            matchScore: pair.sim_score,
            player1: {
                id: pair.id1,
                name: pair.name1,
                nationality: pair.nationality1,
                currentClubId: pair.currentClubId1,
                clubs: pc1.map(c => c.club.name)
            },
            player2: {
                id: pair.id2,
                name: pair.name2,
                nationality: pair.nationality2,
                currentClubId: pair.currentClubId2,
                clubs: pc2.map(c => c.club.name)
            }
        });
    }
    const reportPath = path.resolve(__dirname, '../../duplicate_players_audit.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        summary: { totalSuspectedDuplicates: reportData.length },
        duplicates: reportData
    }, null, 2));
    console.log(`Found ${reportData.length} potential duplicate pairs.`);
    console.log(`Report written to ${reportPath}`);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=audit_duplicates.js.map