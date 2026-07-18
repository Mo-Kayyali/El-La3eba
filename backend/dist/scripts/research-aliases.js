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
const prisma = new client_1.PrismaClient();
async function run() {
    console.log("Fetching all players for backup...");
    const players = await prisma.player.findMany({
        select: { id: true, name: true, nationality: true, aliases: true }
    });
    const backupData = players.map(p => ({
        id: p.id,
        name: p.name,
        aliases: p.aliases || []
    }));
    fs.writeFileSync('aliases_backup.json', JSON.stringify(backupData, null, 2));
    console.log(`Backup created with ${backupData.length} records in aliases_backup.json`);
    const nats = [...new Set(players.map(p => p.nationality))];
    console.log(`\nUnique nationalities in DB:`);
    console.log(nats.join(', '));
    const arabicNats = ['EGY', 'MAR', 'TUN', 'DZA', 'SAU', 'QAT', 'ARE', 'SYR', 'IRQ', 'JOR', 'LBN', 'SDN', 'LBY', 'OMA', 'BHR', 'KWT', 'YEM', 'PLE'];
    const arabicPlayers = players.filter(p => arabicNats.includes(p.nationality));
    console.log(`\nFound ${arabicPlayers.length} players from Arabic nationalities.`);
    const commonNames = arabicPlayers.filter(p => p.name.includes('Mohamed') || p.name.includes('Hussein') || p.name.includes('Mahmoud') ||
        p.name.includes('Youssef') || p.name.includes('Abdallah') || p.name.includes('Mostafa')).slice(0, 20);
    console.log(`\nSample Arabic names in DB:`);
    commonNames.forEach(p => console.log(`- ${p.name}`));
}
run()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=research-aliases.js.map