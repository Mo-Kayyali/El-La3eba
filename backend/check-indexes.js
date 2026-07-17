const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.$queryRawUnsafe(`
    SELECT indexdef FROM pg_indexes WHERE tablename = 'Player';
  `);
  console.log(JSON.stringify(result, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
