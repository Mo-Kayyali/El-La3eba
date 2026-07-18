"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function removeIsrael() {
    const code = 'ISR';
    const clubs = await prisma.club.findMany({ where: { countryCode: code } });
    console.log(`Found ${clubs.length} clubs in ${code}. Deleting...`);
    await prisma.club.deleteMany({ where: { countryCode: code } });
    const comps = await prisma.competition.findMany({ where: { countryCode: code } });
    console.log(`Found ${comps.length} competitions in ${code}. Deleting...`);
    await prisma.competition.deleteMany({ where: { countryCode: code } });
    const players = await prisma.player.findMany({ where: { nationality: code } });
    console.log(`Found ${players.length} players with nationality ${code}. Deleting...`);
    await prisma.player.deleteMany({ where: { nationality: code } });
    console.log(`Deleting Country ${code}...`);
    try {
        await prisma.country.delete({ where: { id: code } });
        console.log('Country deleted successfully.');
    }
    catch (err) {
        console.error('Error deleting country (might already be deleted):', err.message);
    }
}
removeIsrael().finally(() => prisma.$disconnect());
//# sourceMappingURL=remove-israel.js.map