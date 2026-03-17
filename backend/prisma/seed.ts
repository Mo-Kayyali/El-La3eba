import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const players = [
    { name: 'Vinícius Júnior', clubs: ['Real Madrid', 'Flamengo'], activeYear: 2026 },
    { name: 'Jude Bellingham', clubs: ['Real Madrid', 'BVB', 'Birmingham City'], activeYear: 2026 },
    { name: 'Kylian Mbappé', clubs: ['Real Madrid', 'PSG', 'AS Monaco'], activeYear: 2026 },
    { name: 'Erling Haaland', clubs: ['Manchester City', 'BVB', 'RB Salzburg', 'Molde'], activeYear: 2026 },
    { name: 'Kevin De Bruyne', clubs: ['Manchester City', 'VfL Wolfsburg', 'Chelsea', 'Werder Bremen', 'Genk'], activeYear: 2026 },
    { name: 'Lionel Messi', clubs: ['Inter Miami', 'PSG', 'Barcelona'], activeYear: 2026 },
    { name: 'Cristiano Ronaldo', clubs: ['Al Nassr', 'Manchester United', 'Juventus', 'Real Madrid', 'Sporting CP'], activeYear: 2026 },
    { name: 'Harry Kane', clubs: ['Bayern Munich', 'Tottenham Hotspur', 'Leicester City', 'Norwich City', 'Millwall', 'Leyton Orient'], activeYear: 2026 },
    { name: 'Mohamed Salah', clubs: ['Liverpool', 'AS Roma', 'Fiorentina', 'Chelsea', 'FC Basel', 'Al Mokawloon'], activeYear: 2026 },
    { name: 'Bukayo Saka', clubs: ['Arsenal'], activeYear: 2026 },
    { name: 'Phil Foden', clubs: ['Manchester City'], activeYear: 2026 },
    { name: 'Rodri', clubs: ['Manchester City', 'Atletico Madrid', 'Villarreal'], activeYear: 2026 },
    { name: 'Virgil van Dijk', clubs: ['Liverpool', 'Southampton', 'Celtic', 'FC Groningen'], activeYear: 2026 },
    { name: 'Robert Lewandowski', clubs: ['Barcelona', 'Bayern Munich', 'BVB', 'Lech Poznan', 'Znicz Pruszkow'], activeYear: 2026 },
    { name: 'Antoine Griezmann', clubs: ['Atletico Madrid', 'Barcelona', 'Real Sociedad'], activeYear: 2026 },
    { name: 'Bernardo Silva', clubs: ['Manchester City', 'AS Monaco', 'Benfica'], activeYear: 2026 },
    { name: 'Luka Modric', clubs: ['Real Madrid', 'Tottenham Hotspur', 'Dinamo Zagreb', 'Zrinjski Mostar', 'Inter Zapresic'], activeYear: 2026 },
    { name: 'Toni Kroos', clubs: ['Real Madrid', 'Bayern Munich', 'Bayer Leverkusen'], activeYear: 2024 },
    { name: 'Neymar Jr', clubs: ['Al Hilal', 'PSG', 'Barcelona', 'Santos'], activeYear: 2026 },
    { name: 'Thibaut Courtois', clubs: ['Real Madrid', 'Chelsea', 'Atletico Madrid', 'Genk'], activeYear: 2026 },
    { name: 'Alisson Becker', clubs: ['Liverpool', 'AS Roma', 'Internacional'], activeYear: 2026 },
    { name: 'Lamine Yamal', clubs: ['Barcelona'], activeYear: 2026 },
    { name: 'Pedri', clubs: ['Barcelona', 'Las Palmas'], activeYear: 2026 },
    { name: 'Gavi', clubs: ['Barcelona'], activeYear: 2026 },
    { name: 'Cole Palmer', clubs: ['Chelsea', 'Manchester City'], activeYear: 2026 },
    { name: 'Florian Wirtz', clubs: ['Bayer Leverkusen'], activeYear: 2026 },
    { name: 'Jamal Musiala', clubs: ['Bayern Munich'], activeYear: 2026 },
    { name: 'Martin Odegaard', clubs: ['Arsenal', 'Real Madrid', 'Real Sociedad'], activeYear: 2026 },
    { name: 'Son Heung-min', clubs: ['Tottenham Hotspur', 'Bayer Leverkusen', 'Hamburger SV'], activeYear: 2026 },
    { name: 'Bruno Fernandes', clubs: ['Manchester United', 'Sporting CP', 'Sampdoria', 'Udinese'], activeYear: 2026 }
  ];

  console.log('Creating extensions...');
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "unaccent";`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);

  console.log('Start seeding...');
  for (const player of players) {
    const p = await prisma.footballPlayer.create({
      data: player,
    });
    console.log(`Created player with id: ${p.id} (${p.name})`);
  }
  console.log('Seeding finished.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
