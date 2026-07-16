import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt();
  return bcrypt.hash(plain, salt);
}

const testUsers = [
  {
    email: 'player1@gmail.com',
    username: 'player1',
    password: 'player123',
    mmr: 900,
  },
  {
    email: 'player2@gmail.com',
    username: 'player2',
    password: 'player123',
    mmr: 1500,
  },
  {
    email: 'user1@gmail.com',
    username: 'user1',
    password: 'user123',
    mmr: 1100,
  },
  {
    email: 'user2@gmail.com',
    username: 'user2',
    password: 'user123',
    mmr: 1600,
  },
  {
    email: 'admin@gmail.com',
    username: 'admin',
    password: 'admin123',
    mmr: 1000,
    role: 'ADMIN',
  },
];

async function main() {
  console.log('Seeding test users (bcrypt, same flow as AuthService)...');
  for (const u of testUsers) {
    const passwordHash = await hashPassword(u.password);
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        username: u.username,
        passwordHash,
        mmr: u.mmr,
        role: u.role as any || 'PLAYER',
      },
      update: {
        username: u.username,
        passwordHash,
        mmr: u.mmr,
        role: u.role as any || 'PLAYER',
      },
    });
    console.log(`  User OK: ${u.username} <${u.email}> MMR ${u.mmr}`);
  }

  // Ensure extensions are present (idempotent — safe to run on every seed).
  // These are required for the fuzzy-search indexes on Player.name / Player.aliases.
  console.log('Ensuring PostgreSQL extensions...');
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "unaccent";`);
  await prisma.$executeRawUnsafe(
    `CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";`,
  );
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
  console.log('  Extensions OK.');

  console.log('Seeding countries...');
  const iso3166 = require('iso-3166-1');
  const countries = iso3166.all();
  let countryCount = 0;
  for (const c of countries) {
    await prisma.country.upsert({
      where: { id: c.alpha3 },
      create: { id: c.alpha3, name: c.country },
      update: { name: c.country },
    });
    countryCount++;
  }
  console.log(`  Seeded ${countryCount} countries.`);

  // NOTE: Player / Club / Competition / Country data is NOT seeded here.
  // The FootballPlayer table has been removed as part of the structured-schema
  // migration (20260716000000_structured_schema_v2). Real player data will be
  // loaded via the admin import flow in a future session.

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
