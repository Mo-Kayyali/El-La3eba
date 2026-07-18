"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function run() {
    const clubs = await prisma.club.findMany();
    const comps = await prisma.competition.findMany();
    const searchClubs = [
        "Corinthians", "Fluminense", "Millonarios", "Rosario Central", "Inter Miami",
        "Colo", "Universidad Catolica", "Celtic"
    ];
    for (const c of searchClubs) {
        const matches = clubs.filter(x => x.name.toLowerCase().includes(c.toLowerCase()));
        if (matches.length > 0) {
            console.log(`[CLUB] Found ${c}:`, matches.map(m => m.name).join(', '));
        }
        else {
            console.log(`[CLUB] Missing ${c}`);
        }
    }
    const searchComps = [
        "Brazil", "Argentina", "USA", "Major League", "Colombia", "Chile", "Scotland"
    ];
    for (const c of searchComps) {
        const matches = comps.filter(x => x.name.toLowerCase().includes(c.toLowerCase()) || (x.countryCode && x.countryCode.toLowerCase().includes(c.toLowerCase())));
        if (matches.length > 0) {
            console.log(`[COMP] Found ${c}:`, matches.map(m => m.name).join(', '));
        }
        else {
            console.log(`[COMP] Missing ${c}`);
        }
    }
}
run().then(() => prisma.$disconnect());
//# sourceMappingURL=check-clubs.js.map