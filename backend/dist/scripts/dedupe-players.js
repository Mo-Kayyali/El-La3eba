"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function dedupePlayers() {
    console.log("Fetching all players...");
    const players = await prisma.player.findMany({
        include: {
            playerClubs: true,
            currentClub: true
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
        let conflict = false;
        let groupDob = null;
        let groupRetired = null;
        let groupClubId = null;
        for (const r of records) {
            if (r.dateOfBirth) {
                if (groupDob && groupDob.getTime() !== r.dateOfBirth.getTime()) {
                    conflict = true;
                    console.log(`  [CONFLICT] Different Date of Births: ${groupDob.toISOString()} vs ${r.dateOfBirth.toISOString()}`);
                    break;
                }
                groupDob = r.dateOfBirth;
            }
            if (groupRetired !== null) {
                if (groupRetired !== r.isRetired) {
                    conflict = true;
                    console.log(`  [CONFLICT] Different isRetired status: ${groupRetired} vs ${r.isRetired}`);
                    break;
                }
            }
            else {
                groupRetired = r.isRetired;
            }
            if (r.currentClubId) {
                if (groupClubId && groupClubId !== r.currentClubId) {
                    conflict = true;
                    console.log(`  [CONFLICT] Different current clubs: ${groupClubId} vs ${r.currentClubId}`);
                    break;
                }
                groupClubId = r.currentClubId;
            }
        }
        if (conflict) {
            console.log(`  -> SKIPPING ${key} due to conflicts.`);
            skippedGroups++;
            continue;
        }
        let primary = records[0];
        const secondaries = [];
        for (let i = 1; i < records.length; i++) {
            const r = records[i];
            const primaryScore = (primary.playerClubs.length * 10) + (primary.dateOfBirth ? 5 : 0) + (primary.imageUrl ? 2 : 0);
            const rScore = (r.playerClubs.length * 10) + (r.dateOfBirth ? 5 : 0) + (r.imageUrl ? 2 : 0);
            if (rScore > primaryScore) {
                secondaries.push(primary);
                primary = r;
            }
            else {
                secondaries.push(r);
            }
        }
        console.log(`  -> MERGING: Keeping ${primary.id} as Primary. Deleting ${secondaries.length} secondary records.`);
        await prisma.$transaction(async (tx) => {
            const updateData = {};
            if (!primary.dateOfBirth && groupDob)
                updateData.dateOfBirth = groupDob;
            if (!primary.currentClubId && groupClubId)
                updateData.currentClubId = groupClubId;
            const allAliases = new Set(primary.aliases || []);
            for (const s of secondaries) {
                (s.aliases || []).forEach((a) => allAliases.add(a));
            }
            if (allAliases.size > (primary.aliases?.length || 0)) {
                updateData.aliases = Array.from(allAliases);
            }
            if (!primary.imageUrl) {
                const withImg = secondaries.find(s => s.imageUrl);
                if (withImg)
                    updateData.imageUrl = withImg.imageUrl;
            }
            if (Object.keys(updateData).length > 0) {
                await tx.player.update({ where: { id: primary.id }, data: updateData });
            }
            for (const s of secondaries) {
                await tx.question.updateMany({ where: { photoPlayerId: s.id }, data: { photoPlayerId: primary.id } });
                const sAnswers = await tx.questionAnswer.findMany({ where: { playerId: s.id } });
                for (const ans of sAnswers) {
                    const existingPrimaryAns = await tx.questionAnswer.findFirst({
                        where: { questionId: ans.questionId, playerId: primary.id }
                    });
                    if (!existingPrimaryAns) {
                        await tx.questionAnswer.update({
                            where: { id: ans.id },
                            data: { playerId: primary.id }
                        });
                    }
                    else {
                        await tx.questionAnswer.delete({ where: { id: ans.id } });
                    }
                }
                await tx.answerSuggestion.updateMany({ where: { playerId: s.id }, data: { playerId: primary.id } });
                const primaryClubs = new Set(primary.playerClubs.map((pc) => pc.clubId));
                for (const spc of s.playerClubs) {
                    if (!primaryClubs.has(spc.clubId)) {
                        await tx.playerClub.update({
                            where: { id: spc.id },
                            data: { playerId: primary.id }
                        });
                        primaryClubs.add(spc.clubId);
                    }
                    else {
                        await tx.playerClub.delete({ where: { id: spc.id } });
                    }
                }
                await tx.player.delete({ where: { id: s.id } });
                mergedCount++;
            }
        });
    }
    console.log(`\n================================`);
    console.log(`Deduplication Complete!`);
    console.log(`Total duplicated records safely merged/deleted: ${mergedCount}`);
    console.log(`Total duplicate groups skipped due to conflicts: ${skippedGroups}`);
}
dedupePlayers()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=dedupe-players.js.map