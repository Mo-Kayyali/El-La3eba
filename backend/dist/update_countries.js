"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    try {
        const pse = await prisma.country.findUnique({ where: { id: 'PSE' } });
        if (pse) {
            await prisma.country.update({
                where: { id: 'PSE' },
                data: { name: 'Palastine' },
            });
            console.log('Updated Palestine -> Palastine');
        }
        else {
            console.log('Country PSE not found');
        }
        const deu = await prisma.country.findUnique({ where: { id: 'DEU' } });
        if (deu) {
            let ger = await prisma.country.findUnique({ where: { id: 'GER' } });
            if (!ger) {
                ger = await prisma.country.create({
                    data: {
                        id: 'GER',
                        name: deu.name,
                    },
                });
                console.log('Created GER country');
            }
            const clubsUpdated = await prisma.club.updateMany({
                where: { countryCode: 'DEU' },
                data: { countryCode: 'GER' },
            });
            console.log(`Updated ${clubsUpdated.count} clubs to GER`);
            const compsUpdated = await prisma.competition.updateMany({
                where: { countryCode: 'DEU' },
                data: { countryCode: 'GER' },
            });
            console.log(`Updated ${compsUpdated.count} competitions to GER`);
            const playersUpdated = await prisma.player.updateMany({
                where: { nationality: 'DEU' },
                data: { nationality: 'GER' },
            });
            console.log(`Updated ${playersUpdated.count} players to GER`);
            await prisma.country.delete({ where: { id: 'DEU' } });
            console.log('Deleted old DEU country');
        }
        else {
            console.log('Country DEU not found');
        }
    }
    catch (error) {
        console.error('Error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
//# sourceMappingURL=update_countries.js.map