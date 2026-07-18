const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
async function run() {
  for (const n of ['Elmohamady', 'Gamal Abdel', 'Fathy']) {
    const r = await p.player.findMany({where:{name:{contains:n, mode:'insensitive'}}});
    console.log(n, r.length, r.map(x=>x.name));
  }
  await p.$disconnect();
}
run();
