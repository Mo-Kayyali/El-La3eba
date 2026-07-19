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
    const dataDir = path.resolve(__dirname, '../../');
    const auditPath = path.join(dataDir, 'duplicate_players_audit.json');
    if (!fs.existsSync(auditPath)) {
        console.error('Audit file not found');
        return;
    }
    const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    const pairs = auditData.duplicates || [];
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
    const filteredPairs = [];
    let removedNoMatchingClubs = 0;
    let removedCrossNames = 0;
    for (const pair of pairs) {
        const p1 = pair.player1;
        const p2 = pair.player2;
        const db1 = playerMap.get(p1.id) || {};
        const db2 = playerMap.get(p2.id) || {};
        const p1Clubs = p1.clubs || [];
        const p2Clubs = p2.clubs || [];
        const hasMatchingClub = p1Clubs.some((c) => p2Clubs.includes(c));
        const f1 = (db1.firstName || '').toLowerCase();
        const l1 = (db1.lastName || '').toLowerCase();
        const f2 = (db2.firstName || '').toLowerCase();
        const l2 = (db2.lastName || '').toLowerCase();
        let hasCrossName = false;
        if (f1 && l2 && f1 === l2)
            hasCrossName = true;
        if (l1 && f2 && l1 === f2)
            hasCrossName = true;
        if (!hasCrossName) {
            const parts1 = p1.name.toLowerCase().split(' ').filter((x) => x);
            const parts2 = p2.name.toLowerCase().split(' ').filter((x) => x);
            if (parts1.length >= 2 && parts2.length >= 2) {
                if (parts1[0] === parts2[1] || parts1[1] === parts2[0]) {
                    hasCrossName = true;
                }
            }
        }
        if (!hasMatchingClub) {
            removedNoMatchingClubs++;
        }
        else if (hasCrossName) {
            removedCrossNames++;
        }
        else {
            filteredPairs.push(pair);
        }
    }
    fs.writeFileSync(auditPath, JSON.stringify({
        summary: { totalSuspectedDuplicates: filteredPairs.length },
        duplicates: filteredPairs
    }, null, 2));
    console.log(`Removed ${removedNoMatchingClubs} pairs with no matching clubs.`);
    console.log(`Removed ${removedCrossNames} pairs due to crossed first/last names.`);
    console.log(`Remaining suspected duplicates: ${filteredPairs.length}`);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=filter_cross_names.js.map