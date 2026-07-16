"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting QuestionFilterClause cleanup...');
    let clubFixed = 0;
    let compFixed = 0;
    const clauses = await prisma.questionFilterClause.findMany({
        where: { filterType: { in: ['CLUB', 'COMPETITION'] } },
    });
    for (const clause of clauses) {
        if (clause.filterType === 'CLUB') {
            const club = await prisma.club.findUnique({ where: { id: clause.filterValue } }).catch(() => null);
            if (club) {
                await prisma.questionFilterClause.update({
                    where: { id: clause.id },
                    data: { filterValue: club.name }
                });
                clubFixed++;
            }
        }
        else if (clause.filterType === 'COMPETITION') {
            const comp = await prisma.competition.findUnique({ where: { id: clause.filterValue } }).catch(() => null);
            if (comp) {
                await prisma.questionFilterClause.update({
                    where: { id: clause.id },
                    data: { filterValue: comp.name }
                });
                compFixed++;
            }
        }
    }
    console.log(`Cleanup complete. Fixed ${clubFixed} CLUB clauses and ${compFixed} COMPETITION clauses.`);
    await prisma.$disconnect();
}
main().catch(console.error);
//# sourceMappingURL=fix-clauses.js.map