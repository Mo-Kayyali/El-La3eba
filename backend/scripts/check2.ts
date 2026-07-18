import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const c = await prisma.country.findMany({ where: { name: { in: ['Germany', 'Portugal', 'Paraguay', 'Algeria', 'Guatemala', 'Benin'] } } });
  console.log(c);
}
main().finally(() => process.exit(0));
