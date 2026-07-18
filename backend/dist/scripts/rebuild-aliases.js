"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const rules = {
    'mohamed': ['mohammed', 'muhammad', 'muhamed'],
    'mohammed': ['mohamed', 'muhammad', 'muhamed'],
    'muhammad': ['mohamed', 'mohammed', 'muhamed'],
    'ahmed': ['ahmad'],
    'ahmad': ['ahmed'],
    'mahmoud': ['mahmud'],
    'mahmud': ['mahmoud'],
    'youssef': ['yousef', 'yusif'],
    'yousef': ['youssef', 'yusif'],
    'yusif': ['youssef', 'yousef'],
    'hussein': ['hussain'],
    'hussain': ['hussein'],
    'mostafa': ['mustafa'],
    'mustafa': ['mostafa'],
    'abdallah': ['abdullah'],
    'abdullah': ['abdallah'],
    'abdel': ['abdul'],
    'abdul': ['abdel'],
    'el': ['al'],
    'al': ['el'],
    'tarek': ['tariq'],
    'tariq': ['tarek'],
    'omar': ['omer'],
    'omer': ['omar'],
    'karim': ['kareem'],
    'kareem': ['karim']
};
const arabicNats = ['EGY', 'MAR', 'TUN', 'DZA', 'ALG', 'SAU', 'QAT', 'ARE', 'SYR', 'IRQ', 'JOR', 'LBN', 'SDN', 'LBY', 'OMA', 'BHR', 'KWT', 'YEM', 'PLE'];
function generateVariants(name) {
    const words = name.split(/\s+/);
    const variants = new Set();
    for (let i = 0; i < words.length; i++) {
        const w = words[i].toLowerCase();
        if (rules[w]) {
            for (const alt of rules[w]) {
                const newWords = [...words];
                newWords[i] = alt.charAt(0).toUpperCase() + alt.slice(1);
                variants.add(newWords.join(' '));
            }
        }
    }
    const fullWords = [...words];
    let changedAny = false;
    for (let i = 0; i < fullWords.length; i++) {
        const w = fullWords[i].toLowerCase();
        if (rules[w]) {
            const alt = rules[w][0];
            fullWords[i] = alt.charAt(0).toUpperCase() + alt.slice(1);
            changedAny = true;
        }
    }
    if (changedAny) {
        variants.add(fullWords.join(' '));
    }
    variants.delete(name);
    return Array.from(variants).slice(0, 10);
}
async function rebuildAliases() {
    console.log("Fetching all players to build canonical names dictionary...");
    const players = await prisma.player.findMany({ select: { id: true, name: true, nationality: true } });
    const canonicalNames = new Set();
    players.forEach(p => canonicalNames.add(p.name.toLowerCase()));
    console.log(`Clearing all aliases for ${players.length} players...`);
    const clearResult = await prisma.player.updateMany({
        data: { aliases: [] }
    });
    console.log(`Cleared aliases for ${clearResult.count} records.`);
    console.log("\nGenerating transliteration variants...");
    let totalAliasesGenerated = 0;
    let collisionsSkipped = 0;
    const globalClaimedAliases = new Set();
    const sampleResults = [];
    for (const p of players) {
        if (!arabicNats.includes(p.nationality))
            continue;
        const rawVariants = generateVariants(p.name);
        if (rawVariants.length === 0)
            continue;
        const safeVariants = [];
        for (const v of rawVariants) {
            const vLower = v.toLowerCase();
            if (vLower === p.name.toLowerCase())
                continue;
            if (canonicalNames.has(vLower)) {
                collisionsSkipped++;
                continue;
            }
            if (globalClaimedAliases.has(vLower)) {
                collisionsSkipped++;
                continue;
            }
            safeVariants.push(v);
            globalClaimedAliases.add(vLower);
        }
        if (safeVariants.length > 0) {
            await prisma.player.update({
                where: { id: p.id },
                data: { aliases: safeVariants }
            });
            totalAliasesGenerated += safeVariants.length;
            if (sampleResults.length < 30) {
                sampleResults.push({ name: p.name, aliases: safeVariants });
            }
        }
    }
    console.log(`\nRebuild Complete!`);
    console.log(`Total new systematic aliases generated: ${totalAliasesGenerated}`);
    console.log(`Total collisions safely skipped: ${collisionsSkipped}`);
    console.log(`\n--- Sample of Modified Players (Spot Check) ---`);
    for (const s of sampleResults) {
        console.log(`Name: ${s.name} | Aliases: ${JSON.stringify(s.aliases)}`);
    }
}
rebuildAliases()
    .then(() => prisma.$disconnect())
    .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=rebuild-aliases.js.map