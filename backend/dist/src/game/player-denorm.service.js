"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerDenormService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PlayerDenormService = class PlayerDenormService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async regenerateForPlayer(playerId) {
        const playerClubs = await this.prisma.playerClub.findMany({
            where: { playerId },
            include: {
                club: {
                    select: {
                        name: true,
                        competitions: true,
                    },
                },
            },
            orderBy: [
                { isCurrent: 'desc' },
                { startYear: 'asc' },
            ],
        });
        const clubsSeen = new Set();
        const clubs = [];
        for (const pc of playerClubs) {
            if (!clubsSeen.has(pc.club.name)) {
                clubsSeen.add(pc.club.name);
                clubs.push(pc.club.name);
            }
        }
        const competitionsSeen = new Set();
        for (const pc of playerClubs) {
            for (const comp of pc.club.competitions) {
                competitionsSeen.add(comp);
            }
        }
        const competitions = Array.from(competitionsSeen);
        await this.prisma.player.update({
            where: { id: playerId },
            data: { clubs, competitions },
        });
        return { clubs, competitions };
    }
    async regenerateForClub(clubId) {
        const affectedPlayers = await this.prisma.playerClub.findMany({
            where: { clubId },
            select: { playerId: true },
            distinct: ['playerId'],
        });
        for (const { playerId } of affectedPlayers) {
            await this.regenerateForPlayer(playerId);
        }
    }
};
exports.PlayerDenormService = PlayerDenormService;
exports.PlayerDenormService = PlayerDenormService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlayerDenormService);
//# sourceMappingURL=player-denorm.service.js.map