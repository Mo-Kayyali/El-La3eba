"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function findDupes() {
    const players = await prisma.player.findMany({
        select: { id: true, name: true, nationality: true },
    });
    const map = new Map();
    for (const p of players) {
        const key = `${p.name}___${p.nationality}`;
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(p);
    }
    const dupes = [];
    for (const [key, records] of map.entries()) {
        if (records.length > 1) {
            dupes.push({
                name: records[0].name,
                nationality: records[0].nationality,
                count: records.length,
                ids: records.map(r => r.id)
            });
        }
    }
    if (dupes.length === 0) {
        console.log('No duplicates found.');
        return;
    }
    console.log(`Found ${dupes.length} duplicated names:`);
    let totalDupes = 0;
    for (const d of dupes) {
        console.log(`- ${d.name} (${d.nationality}) : ${d.count} records`);
        totalDupes += d.count - 1;
    }
    console.log(`\nTotal extra records to potentially delete: ${totalDupes}`);
}
findDupes()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=find-dupes.js.map