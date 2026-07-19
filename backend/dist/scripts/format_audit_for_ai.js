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
    const auditPath = path.join(dataDir, 'player_audit_report.json');
    if (!fs.existsSync(auditPath)) {
        console.error('Audit file not found');
        return;
    }
    const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    const players = auditData.flaggedPlayers || [];
    const enrichedFormat = [];
    for (const p of players) {
        const pcs = await prisma.playerClub.findMany({
            where: { playerId: p.id },
            include: { club: true }
        });
        const clubHistory = pcs.map(pc => {
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
            return {
                clubName: pc.club.name,
                approxYears
            };
        });
        enrichedFormat.push({
            id: p.id,
            name: p.name,
            nationality: p.nationality,
            isRetired: p.isRetired,
            clubHistory: clubHistory
        });
    }
    fs.writeFileSync(auditPath, JSON.stringify(enrichedFormat, null, 2));
    console.log(`Formatted ${enrichedFormat.length} players for AI enrichment.`);
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=format_audit_for_ai.js.map