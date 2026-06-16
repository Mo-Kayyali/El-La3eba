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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const redis_service_1 = require("../redis/redis.service");
let AuthService = class AuthService {
    prisma;
    jwtService;
    redisService;
    constructor(prisma, jwtService, redisService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
        this.redisService = redisService;
    }
    penaltyKey(userId) {
        return `penalty:${userId}`;
    }
    activeGameKey(userId) {
        return `user_active_game:${userId}`;
    }
    async getPendingOfflinePenalty(userId) {
        const cached = await this.redisService.get(this.penaltyKey(userId));
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed?.id && parsed?.gameSessionId) {
                    return parsed;
                }
            }
            catch {
                await this.redisService.del(this.penaltyKey(userId)).catch(() => 0);
            }
        }
        const penalty = await this.prisma.offlinePenalty.findFirst({
            where: {
                userId,
                acknowledgedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!penalty)
            return null;
        const payload = {
            id: penalty.id,
            mmrLost: penalty.mmrLost,
            gameSessionId: penalty.gameSessionId,
            createdAt: penalty.createdAt.toISOString(),
        };
        await this.redisService.set(this.penaltyKey(userId), JSON.stringify(payload), 'EX', 60 * 60 * 24 * 7);
        return payload;
    }
    async register(dto) {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.email }, { username: dto.username }],
            },
        });
        if (existingUser) {
            throw new common_1.ConflictException('Username or Email already exists');
        }
        const salt = await bcrypt.genSalt();
        const passwordHash = await bcrypt.hash(dto.password, salt);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email,
                username: dto.username,
                passwordHash,
            },
        });
        return this.generateToken(user, false);
    }
    async login(dto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return this.generateToken(user, dto.rememberMe === true);
    }
    async getProfileById(userId) {
        const [user, pendingIncomingFriendRequests, pendingOfflinePenalty, activeGameSessionId,] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    mmr: true,
                    wins: true,
                    gamesPlayed: true,
                    isVerified: true,
                    createdAt: true,
                    offlineDisconnectCount: true,
                    lastDisconnectAt: true,
                },
            }),
            this.prisma.friendship.count({
                where: {
                    friendId: userId,
                    status: client_1.FriendshipStatus.PENDING,
                },
            }),
            this.getPendingOfflinePenalty(userId),
            (async () => {
                const primary = await this.redisService.get(this.activeGameKey(userId));
                if (primary)
                    return primary;
                const legacy = await this.redisService.get(`active_game:${userId}`);
                if (!legacy)
                    return null;
                await this.redisService
                    .multi()
                    .set(this.activeGameKey(userId), legacy)
                    .del(`active_game:${userId}`)
                    .exec()
                    .catch(() => null);
                return legacy;
            })(),
        ]);
        if (!user) {
            throw new common_1.UnauthorizedException();
        }
        return {
            ...user,
            activeGameSessionId,
            pendingIncomingFriendRequests,
            pendingOfflinePenalty,
        };
    }
    async acknowledgeOfflinePenalty(userId) {
        const acknowledgedAt = new Date();
        const result = await this.prisma.offlinePenalty.updateMany({
            where: {
                userId,
                acknowledgedAt: null,
            },
            data: { acknowledgedAt },
        });
        await this.redisService.del(this.penaltyKey(userId)).catch(() => 0);
        return {
            success: true,
            cleared: result.count,
        };
    }
    generateToken(user, rememberMe = false) {
        const payload = {
            sub: user.id,
            username: user.username,
            email: user.email,
        };
        const expiresIn = rememberMe ? '30d' : '1d';
        return {
            access_token: this.jwtService.sign(payload, { expiresIn }),
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                isVerified: user.isVerified,
                mmr: user.mmr,
            },
        };
    }
    async requestVerification(userId, email) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const key = `verify_email:${userId}`;
        await this.redisService.set(key, code, 'EX', 900);
        console.log(`[SIMULATED EMAIL] To: ${email} - Verification Code: ${code}`);
        return {
            success: true,
            message: 'Verification code generated and "sent" via email.',
        };
    }
    async verifyEmail(userId, code) {
        const key = `verify_email:${userId}`;
        const storedCode = await this.redisService.get(key);
        if (!storedCode) {
            throw new common_1.UnauthorizedException('Verification code expired or not found.');
        }
        if (storedCode !== code) {
            throw new common_1.UnauthorizedException('Invalid verification code.');
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { isVerified: true },
        });
        await this.redisService.del(key);
        return { success: true, message: 'Email successfully verified.' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        redis_service_1.RedisService])
], AuthService);
//# sourceMappingURL=auth.service.js.map