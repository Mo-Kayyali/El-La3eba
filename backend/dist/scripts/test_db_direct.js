"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function run() {
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    console.log('Admin email:', admin?.email);
    console.log('\n--- Testing Players Service Query ---');
    const search = 'mohamed';
    const playersRes = await prisma.$transaction([
        prisma.$queryRawUnsafe(`
      SELECT p.id
      FROM "Player" p
      WHERE word_similarity($1, lower(unaccent_immutable(p.name))) > 0.3
      ORDER BY word_similarity($1, lower(unaccent_immutable(p.name))) DESC
      LIMIT 2
    `, search)
    ]);
    console.log('Players query executed successfully:', playersRes[0]);
    console.log('\n--- Testing Clubs Service Query ---');
    const clubsRes = await prisma.$transaction([
        prisma.$queryRawUnsafe(`
      SELECT c.id
      FROM "Club" c
      WHERE word_similarity($1, lower(unaccent_immutable(c.name))) > 0.3
      ORDER BY word_similarity($1, lower(unaccent_immutable(c.name))) DESC
      LIMIT 2
    `, 'ahly')
    ]);
    console.log('Clubs query executed successfully:', clubsRes[0]);
    console.log('\n--- Testing Competitions Service Query ---');
    const compsRes = await prisma.$transaction([
        prisma.$queryRawUnsafe(`
      SELECT c.id
      FROM "Competition" c
      WHERE word_similarity($1, lower(unaccent_immutable(c.name))) > 0.3
      ORDER BY word_similarity($1, lower(unaccent_immutable(c.name))) DESC
      LIMIT 2
    `, 'premier')
    ]);
    console.log('Competitions query executed successfully:', compsRes[0]);
    console.log('\n--- Testing Questions Query ---');
    const questionsRes = await prisma.question.findMany({
        take: 2,
        include: { _count: { select: { answers: true } } }
    });
    console.log('Questions query executed successfully, found:', questionsRes.length);
    console.log('\n--- Testing Suggestions Query ---');
    const suggestionsRes = await prisma.answerSuggestion.findMany({
        take: 2,
        include: { player: true, question: true, suggester: true }
    });
    console.log('Suggestions query executed successfully, found:', suggestionsRes.length);
}
run().finally(() => prisma.$disconnect());
//# sourceMappingURL=test_db_direct.js.map