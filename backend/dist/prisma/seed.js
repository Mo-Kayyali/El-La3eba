"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcrypt"));
const prisma = new client_1.PrismaClient();
async function hashPassword(plain) {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(plain, salt);
}
const testUsers = [
    {
        email: 'player1@gmail.com',
        username: 'player1',
        password: 'player123',
        mmr: 1000,
    },
    {
        email: 'player2@gmail.com',
        username: 'player2',
        password: 'player123',
        mmr: 1200,
    },
    {
        email: 'user1@gmail.com',
        username: 'user1',
        password: 'user123',
        mmr: 1000,
    },
    {
        email: 'user2@gmail.com',
        username: 'user2',
        password: 'user123',
        mmr: 1500,
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
            },
            update: {
                username: u.username,
                passwordHash,
                mmr: u.mmr,
            },
        });
        console.log(`  User OK: ${u.username} <${u.email}> MMR ${u.mmr}`);
    }
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
        { name: 'Bruno Fernandes', clubs: ['Manchester United', 'Sporting CP', 'Sampdoria', 'Udinese'], activeYear: 2026 },
    ];
    console.log('Creating extensions...');
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "unaccent";`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
    const existingCount = await prisma.footballPlayer.count();
    if (existingCount > 0) {
        console.log(`Skipping football players (${existingCount} already in DB). Delete rows to re-seed.`);
    }
    else {
        console.log('Seeding football players...');
        for (const player of players) {
            const p = await prisma.footballPlayer.create({
                data: player,
            });
            console.log(`  Created player: ${p.name}`);
        }
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
//# sourceMappingURL=seed.js.map