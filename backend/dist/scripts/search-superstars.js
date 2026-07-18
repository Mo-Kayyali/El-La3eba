"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const terms = [
    "Suarez", "Cavani", "Vidal", "Di Maria", "Falcao", "Memphis", "Hernandez", "Hulk", "Gervinho"
];
async function run() {
    const players = await prisma.player.findMany({
        select: { id: true, name: true, nationality: true }
    });
    const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const m of terms) {
        const mNorm = normalize(m);
        const matches = players.filter(p => {
            const pNorm = normalize(p.name);
            return pNorm.includes(mNorm);
        });
        console.log(`\n--- Matches for ${m} ---`);
        console.log(matches.map(x => `${x.name} (${x.nationality})`).slice(0, 10).join(' | '));
    }
}
run().then(() => prisma.$disconnect());
//# sourceMappingURL=search-superstars.js.map