import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.question.count({
    where: { answerType: 'FILTER' }
  });
  console.log('FILTER question count:', count);
}
main().finally(() => process.exit(0));
