import { PrismaClient } from '@prisma/client';
import { POSITION_CATEGORY_MAP } from './src/game/position.util';

const prisma = new PrismaClient();

async function main() {
  const pedri = await prisma.player.findFirst({ where: { name: 'Pedri' }});
  const jude = await prisma.player.findFirst({ where: { name: 'Jude Bellingham' }});
  
  console.log("Pedri competitions:", pedri?.competitions);
  console.log("Jude competitions:", jude?.competitions);

  // Evaluator logic trace
  const evaluatePosition = (player: any, filterValue: string) => {
    const allowedPositions = filterValue ? POSITION_CATEGORY_MAP[filterValue] || [] : [];
    return player.positions?.some((p: string) => allowedPositions.includes(p)) ?? false;
  };

  const evaluateCompetition = (player: any, filterValue: string) => {
    return player.competitions?.includes(filterValue) ?? false;
  };

  console.log("Pedri POSITION_CATEGORY MIDFIELDER:", evaluatePosition(pedri, "MIDFIELDER"));
  console.log("Jude POSITION_CATEGORY MIDFIELDER:", evaluatePosition(jude, "MIDFIELDER"));

  console.log("Pedri COMPETITION LaLiga:", evaluateCompetition(pedri, "LaLiga"));
  console.log("Jude COMPETITION LaLiga:", evaluateCompetition(jude, "LaLiga"));
}

main().catch(console.error).finally(() => prisma.$disconnect());
