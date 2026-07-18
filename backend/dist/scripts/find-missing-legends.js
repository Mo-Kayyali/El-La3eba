"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const missing = [
    "Garrincha", "Bebeto", "Hulk", "Grafite", "Munir", "Chico Conceição", "Gervinho",
    "Jay-Jay Okocha", "Adolfo Valencia", "Lionel Messi", "Memphis Depay", "Javier Hernandez",
    "Radamel Falcao", "Zinedine Zidane", "Angel Di Maria", "Paulo Dybala", "Luis Suarez",
    "Edinson Cavani", "Gerd Muller", "Arturo Vidal", "David Silva", "Rene Higuita",
    "Lautaro Martinez", "Dennis Bergkamp", "Ferenc Puskas", "Bryan Robson", "Diego Simeone"
];
async function run() {
    const players = await prisma.player.findMany({
        select: { id: true, name: true, nationality: true }
    });
    const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    for (const m of missing) {
        const mNorm = normalize(m);
        const mWords = mNorm.split(' ');
        const matches = players.filter(p => {
            const pNorm = normalize(p.name);
            return mWords.every(w => pNorm.includes(w)) || pNorm === mNorm;
        });
        if (matches.length > 0) {
            console.log(`FOUND ${m}: `, matches.map(x => `${x.name} (${x.nationality})`).join(' | '));
        }
        else {
            console.log(`NOT FOUND: ${m}`);
        }
    }
}
run().then(() => prisma.$disconnect());
//# sourceMappingURL=find-missing-legends.js.map