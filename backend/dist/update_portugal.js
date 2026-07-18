"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    try {
        const prt = await prisma.country.findUnique({ where: { id: 'PRT' } });
        if (prt) {
            let por = await prisma.country.findUnique({ where: { id: 'POR' } });
            if (!por) {
                por = await prisma.country.create({
                    data: {
                        id: 'POR',
                        name: prt.name,
                    },
                });
                console.log('Created POR country');
            }
            const clubsUpdated = await prisma.club.updateMany({
                where: { countryCode: 'PRT' },
                data: { countryCode: 'POR' },
            });
            console.log(`Updated ${clubsUpdated.count} clubs to POR`);
            const compsUpdated = await prisma.competition.updateMany({
                where: { countryCode: 'PRT' },
                data: { countryCode: 'POR' },
            });
            console.log(`Updated ${compsUpdated.count} competitions to POR`);
            const playersUpdated = await prisma.player.updateMany({
                where: { nationality: 'PRT' },
                data: { nationality: 'POR' },
            });
            console.log(`Updated ${playersUpdated.count} players to POR`);
            await prisma.country.delete({ where: { id: 'PRT' } });
            console.log('Deleted old PRT country');
        }
        else {
            console.log('Country PRT not found');
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
//# sourceMappingURL=update_portugal.js.map