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
function levenshtein(a, b) {
    if (a.length === 0)
        return b.length;
    if (b.length === 0)
        return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}
async function main() {
    const dataDir = path.resolve(__dirname, '../../');
    const auditPath = path.join(dataDir, 'duplicate_players_audit.json');
    if (!fs.existsSync(auditPath)) {
        console.error('Audit file not found');
        return;
    }
    const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    const pairs = auditData.duplicates || [];
    const toMerge = [];
    const theRest = [];
    const playerIds = new Set();
    for (const p of pairs) {
        playerIds.add(p.player1.id);
        playerIds.add(p.player2.id);
    }
    const playersFromDb = await prisma.player.findMany({
        where: { id: { in: Array.from(playerIds) } },
        select: { id: true, firstName: true, lastName: true }
    });
    const playerMap = new Map();
    for (const p of playersFromDb) {
        playerMap.set(p.id, p);
    }
    for (const pair of pairs) {
        const p1 = pair.player1;
        const p2 = pair.player2;
        const db1 = playerMap.get(p1.id);
        const db2 = playerMap.get(p2.id);
        const sameNationality = p1.nationality === p2.nationality;
        const sameCurrentClub = p1.currentClubId === p2.currentClubId;
        const levDist = levenshtein(p1.name.toLowerCase(), p2.name.toLowerCase());
        const exactFirstLast = db1 && db2 &&
            db1.firstName && db2.firstName &&
            db1.firstName.toLowerCase() === db2.firstName.toLowerCase() &&
            db1.lastName && db2.lastName &&
            db1.lastName.toLowerCase() === db2.lastName.toLowerCase();
        const nameMatch = levDist <= 1 || exactFirstLast;
        if (sameNationality && sameCurrentClub && nameMatch) {
            toMerge.push(pair);
        }
        else {
            theRest.push(pair);
        }
    }
    const toMergePath = path.join(dataDir, 'duplicate_players_to_merge.json');
    fs.writeFileSync(toMergePath, JSON.stringify({
        summary: { count: toMerge.length },
        duplicates: toMerge
    }, null, 2));
    fs.writeFileSync(auditPath, JSON.stringify({
        summary: { count: theRest.length },
        duplicates: theRest
    }, null, 2));
    console.log(`Split complete!`);
    console.log(`To merge: ${toMerge.length} pairs`);
    console.log(`Remaining: ${theRest.length} pairs`);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=prepare_merge_duplicates.js.map