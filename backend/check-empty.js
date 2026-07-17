const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.player.count();
  console.log(`Player count: ${count}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
