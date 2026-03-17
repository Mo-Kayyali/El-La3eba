const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { username: true, isVerified: true } });
  console.log('Users in DB:');
  console.table(users);
}
main().catch(console.error).finally(() => prisma.$disconnect());
