const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
async function run() {
  const r = await Promise.all(['Ahmed El Mohamady', 'Gamal Abdel-Hamid', 'Ahmed Fathi'].map(n=>
    p.player.updateMany({where:{name:n}, data:{nationality:'EGY', isRetired:true}})
  ));
  console.log(r);
  await p.$disconnect();
}
run();
