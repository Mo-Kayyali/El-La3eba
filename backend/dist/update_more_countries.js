"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function updateCountry(oldCode, newCode) {
    const oldCountry = await prisma.country.findUnique({ where: { id: oldCode } });
    if (oldCountry) {
        let newCountry = await prisma.country.findUnique({ where: { id: newCode } });
        if (!newCountry) {
            newCountry = await prisma.country.create({
                data: {
                    id: newCode,
                    name: oldCountry.name,
                },
            });
            console.log(`Created ${newCode} country`);
        }
        const clubsUpdated = await prisma.club.updateMany({
            where: { countryCode: oldCode },
            data: { countryCode: newCode },
        });
        console.log(`Updated ${clubsUpdated.count} clubs to ${newCode}`);
        const compsUpdated = await prisma.competition.updateMany({
            where: { countryCode: oldCode },
            data: { countryCode: newCode },
        });
        console.log(`Updated ${compsUpdated.count} competitions to ${newCode}`);
        const playersUpdated = await prisma.player.updateMany({
            where: { nationality: oldCode },
            data: { nationality: newCode },
        });
        console.log(`Updated ${playersUpdated.count} players to ${newCode}`);
        await prisma.country.delete({ where: { id: oldCode } });
        console.log(`Deleted old ${oldCode} country`);
    }
    else {
        console.log(`Country ${oldCode} not found`);
    }
}
async function main() {
    try {
        console.log('--- Updating Congo (COD to CGO) ---');
        await updateCountry('COD', 'CGO');
        console.log('\n--- Updating Algeria (DZA to ALG) ---');
        await updateCountry('DZA', 'ALG');
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=update_more_countries.js.map