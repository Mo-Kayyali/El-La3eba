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
    console.log('Ensuring PostgreSQL extensions...');
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "unaccent";`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";`);
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pg_trgm";`);
    console.log('  Extensions OK.');
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