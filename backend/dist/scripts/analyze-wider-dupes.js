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
async function analyzeWiderDupes() {
    const players = await prisma.player.findMany({
        include: {
            playerClubs: { include: { club: true } }
        }
    });
    const map = new Map();
    for (const p of players) {
        const key = p.name;
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(p);
    }
    const dupes = [];
    for (const [key, records] of map.entries()) {
        if (records.length > 1) {
            dupes.push({
                name: key,
                records: records.map(r => ({
                    id: r.id,
                    nationality: r.nationality,
                    isRetired: r.isRetired,
                    dateOfBirth: r.dateOfBirth,
                    clubCount: r.playerClubs.length,
                    clubs: r.playerClubs.map((pc) => pc.club.name)
                }))
            });
        }
    }
    fs.writeFileSync('wider_dupes.json', JSON.stringify(dupes, null, 2));
    console.log(`Found ${dupes.length} duplicated names.`);
}
analyzeWiderDupes()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=analyze-wider-dupes.js.map