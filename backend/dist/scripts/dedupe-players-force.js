"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function dedupePlayersForce() {
    console.log("Fetching all players...");
    const players = await prisma.player.findMany({
        include: {
            playerClubs: { include: { club: true } }
        }
    });
    const map = new Map();
    for (const p of players) {
        const key = `${p.name}___${p.nationality}`;
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(p);
    }
    let mergedCount = 0;
    let skippedGroups = 0;
    for (const [key, records] of map.entries()) {
        if (records.length < 2)
            continue;
        console.log(`\nEvaluating group: ${key} (${records.length} records)`);
        records.sort((a, b) => b.playerClubs.length - a.playerClubs.length);
        let primaries = [];
        for (const r of records) {
            if (primaries.length === 0) {
                primaries.push(r);
                continue;
            }
            let merged = false;
            for (const primary of primaries) {
                const rClubs = new Set(r.playerClubs.map((pc) => pc.clubId));
                const primaryClubs = new Set(primary.playerClubs.map((pc) => pc.clubId));
                const hasIntersection = [...rClubs].some(c => primaryClubs.has(c));
                const isEmpty = rClubs.size === 0;
                if (isEmpty || hasIntersection) {
                    console.log(`  -> Merging ${r.id} into ${primary.id} (Empty: ${isEmpty}, Intersect: ${hasIntersection})`);
                    await prisma.$transaction(async (tx) => {
                        const updateData = {};
                        if (!primary.dateOfBirth && r.dateOfBirth)
                            updateData.dateOfBirth = r.dateOfBirth;
                        if (!primary.currentClubId && r.currentClubId)
                            updateData.currentClubId = r.currentClubId;
                        const allAliases = new Set(primary.aliases || []);
                        (r.aliases || []).forEach((a) => allAliases.add(a));
                        if (allAliases.size > (primary.aliases?.length || 0)) {
                            updateData.aliases = Array.from(allAliases);
                        }
                        if (!primary.imageUrl && r.imageUrl)
                            updateData.imageUrl = r.imageUrl;
                        if (Object.keys(updateData).length > 0) {
                            await tx.player.update({ where: { id: primary.id }, data: updateData });
                            Object.assign(primary, updateData);
                        }
                        await tx.question.updateMany({ where: { photoPlayerId: r.id }, data: { photoPlayerId: primary.id } });
                        const rAnswers = await tx.questionAnswer.findMany({ where: { playerId: r.id } });
                        for (const ans of rAnswers) {
                            const existingPrimaryAns = await tx.questionAnswer.findFirst({
                                where: { questionId: ans.questionId, playerId: primary.id }
                            });
                            if (!existingPrimaryAns) {
                                await tx.questionAnswer.update({ where: { id: ans.id }, data: { playerId: primary.id } });
                            }
                            else {
                                await tx.questionAnswer.delete({ where: { id: ans.id } });
                            }
                        }
                        await tx.answerSuggestion.updateMany({ where: { playerId: r.id }, data: { playerId: primary.id } });
                        for (const rpc of r.playerClubs) {
                            if (!primaryClubs.has(rpc.clubId)) {
                                await tx.playerClub.update({ where: { id: rpc.id }, data: { playerId: primary.id } });
                                primary.playerClubs.push({ ...rpc, playerId: primary.id });
                            }
                            else {
                                await tx.playerClub.delete({ where: { id: rpc.id } });
                            }
                        }
                        await tx.player.delete({ where: { id: r.id } });
                        mergedCount++;
                    });
                    merged = true;
                    break;
                }
            }
            if (!merged) {
                console.log(`  -> Keeping ${r.id} as a DISTINCT player (no overlap).`);
                primaries.push(r);
            }
        }
    }
    console.log(`\n================================`);
    console.log(`Force Deduplication Complete!`);
    console.log(`Total duplicated records successfully merged/deleted: ${mergedCount}`);
}
dedupePlayersForce()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=dedupe-players-force.js.map