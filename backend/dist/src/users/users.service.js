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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../prisma/prisma.service");
const redis_service_1 = require("../redis/redis.service");
let UsersService = class UsersService {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    penaltyKey(userId) {
        return `penalty:${userId}`;
    }
    async recordOfflinePenalty(userId, gameSessionId, mmrLost) {
        const now = new Date();
        const safeMmrLost = Math.max(0, Math.round(mmrLost));
        const penalty = await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: {
                    offlineDisconnectCount: { increment: 1 },
                    lastDisconnectAt: now,
                },
            });
            return tx.offlinePenalty.create({
                data: {
                    userId,
                    gameSessionId,
                    mmrLost: safeMmrLost,
                },
            });
        });
        await this.redis.set(this.penaltyKey(userId), JSON.stringify({
            id: penalty.id,
            mmrLost: penalty.mmrLost,
            gameSessionId: penalty.gameSessionId,
            createdAt: penalty.createdAt.toISOString(),
        }), 'EX', 60 * 60 * 24 * 7);
        return penalty;
    }
    async getPendingOfflinePenalty(userId) {
        const cached = await this.redis.get(this.penaltyKey(userId));
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed?.id && parsed?.gameSessionId) {
                    return parsed;
                }
            }
            catch {
                await this.redis.del(this.penaltyKey(userId)).catch(() => 0);
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
        await this.redis.set(this.penaltyKey(userId), JSON.stringify(payload), 'EX', 60 * 60 * 24 * 7);
        return payload;
    }
    async getPublicProfileById(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                gamesPlayed: true,
                wins: true,
            },
        });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user;
    }
    async updateOwnProfile(userId, dto) {
        const hasAnyField = dto.username !== undefined ||
            dto.email !== undefined ||
            dto.password !== undefined;
        if (!hasAnyField) {
            throw new common_1.BadRequestException('Provide at least one field to update');
        }
        const data = {};
        if (dto.username !== undefined)
            data.username = dto.username;
        if (dto.email !== undefined)
            data.email = dto.email;
        if (dto.password !== undefined) {
            if (!dto.currentPassword) {
                throw new common_1.BadRequestException('currentPassword is required when changing your password.');
            }
            const userRecord = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { passwordHash: true },
            });
            if (!userRecord)
                throw new common_1.NotFoundException('User not found');
            const currentPasswordValid = await bcrypt.compare(dto.currentPassword, userRecord.passwordHash);
            if (!currentPasswordValid) {
                throw new common_1.ForbiddenException('Current password is incorrect.');
            }
            const salt = await bcrypt.genSalt();
            data.passwordHash = await bcrypt.hash(dto.password, salt);
        }
        try {
            const updatedUser = await this.prisma.$transaction(async (tx) => {
                return tx.user.update({
                    where: { id: userId },
                    data,
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        mmr: true,
                        wins: true,
                        gamesPlayed: true,
                        isVerified: true,
                        createdAt: true,
                    },
                });
            });
            return updatedUser;
        }
        catch (err) {
            const prismaErr = err;
            if (prismaErr.code === 'P2025') {
                throw new common_1.NotFoundException('User not found');
            }
            if (prismaErr.code === 'P2002') {
                const targets = Array.isArray(prismaErr.meta?.target)
                    ? prismaErr.meta?.target
                    : [];
                if (targets.includes('username')) {
                    throw new common_1.BadRequestException('Username already exists');
                }
                if (targets.includes('email')) {
                    throw new common_1.BadRequestException('Email already exists');
                }
                throw new common_1.BadRequestException('Username or email already exists');
            }
            throw new common_1.InternalServerErrorException('Failed to update profile');
        }
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        redis_service_1.RedisService])
], UsersService);
//# sourceMappingURL=users.service.js.map