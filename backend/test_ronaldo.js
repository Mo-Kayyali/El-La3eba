const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const res = await prisma.player.findMany({ where: { name: { contains: 'ronaldo', mode: 'insensitive' } } });
  console.log(res.map(p => p.name));
}

main().finally(() => prisma.$disconnect());
