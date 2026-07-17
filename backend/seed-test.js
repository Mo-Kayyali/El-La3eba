const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Deleting synthetic players...');
  await prisma.player.deleteMany({
    where: { firstName: 'Test' }
  });
  const count = await prisma.player.count();
  console.log('Player count after deletion: ' + count);
}
main().catch(console.error).finally(() => prisma.$disconnect());
