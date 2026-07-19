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
exports.ClubDenormService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const player_denorm_service_1 = require("./player-denorm.service");
let ClubDenormService = class ClubDenormService {
    prisma;
    playerDenormService;
    constructor(prisma, playerDenormService) {
        this.prisma = prisma;
        this.playerDenormService = playerDenormService;
    }
    async regenerateForClub(clubId) {
        const clubCompetitions = await this.prisma.clubCompetition.findMany({
            where: { clubId },
            include: {
                competition: {
                    select: { name: true },
                },
            },
        });
        const competitions = clubCompetitions.map((cc) => cc.competition.name);
        await this.prisma.club.update({
            where: { id: clubId },
            data: { competitions },
        });
        await this.playerDenormService.regenerateForClub(clubId);
        return competitions;
    }
};
exports.ClubDenormService = ClubDenormService;
exports.ClubDenormService = ClubDenormService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        player_denorm_service_1.PlayerDenormService])
], ClubDenormService);
//# sourceMappingURL=club-denorm.service.js.map