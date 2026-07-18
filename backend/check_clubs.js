const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
async function run() {
  const zed = await p.club.findMany({where:{name:{contains:'ZED'}}});
  const bank = await p.club.findMany({where:{name:{contains:'Bank'}}});
  const dreams = await p.club.findMany({where:{name:{contains:'Dreams'}}});
  console.log('ZED:', zed.map(x=>x.name));
  console.log('Bank:', bank.map(x=>x.name));
  console.log('Dreams:', dreams.map(x=>x.name));
  await p.$disconnect();
}
run();
