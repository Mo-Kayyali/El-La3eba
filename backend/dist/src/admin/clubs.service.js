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
exports.AdminClubsService = exports.UpdateClubDto = exports.CreateClubDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const class_validator_1 = require("class-validator");
class CreateClubDto {
    name;
    aliases;
    countryCode;
    currentCompetitionId;
    competitionIds;
    logoUrl;
}
exports.CreateClubDto = CreateClubDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClubDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateClubDto.prototype, "aliases", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClubDto.prototype, "countryCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateClubDto.prototype, "currentCompetitionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], CreateClubDto.prototype, "competitionIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClubDto.prototype, "logoUrl", void 0);
class UpdateClubDto {
    name;
    aliases;
    countryCode;
    currentCompetitionId;
    competitionIds;
    logoUrl;
}
exports.UpdateClubDto = UpdateClubDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateClubDto.prototype, "aliases", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "countryCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "currentCompetitionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('all', { each: true }),
    __metadata("design:type", Array)
], UpdateClubDto.prototype, "competitionIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "logoUrl", void 0);
const club_denorm_service_1 = require("../game/club-denorm.service");
let AdminClubsService = class AdminClubsService {
    prisma;
    clubDenormService;
    constructor(prisma, clubDenormService) {
        this.prisma = prisma;
        this.clubDenormService = clubDenormService;
    }
    async validateFks(countryCode, currentCompetitionId) {
        if (countryCode) {
            const country = await this.prisma.country.findUnique({ where: { id: countryCode } });
            if (!country)
                throw new common_1.BadRequestException(`Country code '${countryCode}' does not exist.`);
        }
        if (currentCompetitionId) {
            const comp = await this.prisma.competition.findUnique({ where: { id: currentCompetitionId } });
            if (!comp)
                throw new common_1.BadRequestException(`Competition ID '${currentCompetitionId}' does not exist.`);
        }
    }
    async validateCompetitions(competitionIds) {
        if (competitionIds && competitionIds.length > 0) {
            const comps = await this.prisma.competition.findMany({
                where: { id: { in: competitionIds } }
            });
            if (comps.length !== competitionIds.length) {
                throw new common_1.BadRequestException('One or more competition IDs are invalid.');
            }
        }
    }
    async findAll() {
        return this.prisma.club.findMany({
            orderBy: { name: 'asc' },
        });
    }
    async findOne(id) {
        const club = await this.prisma.club.findUnique({
            where: { id },
            include: {
                clubCompetitions: {
                    select: { competitionId: true }
                }
            }
        });
        if (!club)
            throw new common_1.NotFoundException('Club not found');
        return {
            ...club,
            competitionIds: club.clubCompetitions.map(cc => cc.competitionId)
        };
    }
    async create(dto) {
        await this.validateFks(dto.countryCode, dto.currentCompetitionId);
        await this.validateCompetitions(dto.competitionIds);
        const { competitionIds, ...clubData } = dto;
        const club = await this.prisma.club.create({ data: clubData });
        if (competitionIds && competitionIds.length > 0) {
            await this.prisma.clubCompetition.createMany({
                data: competitionIds.map(compId => ({
                    clubId: club.id,
                    competitionId: compId
                }))
            });
            await this.clubDenormService.regenerateForClub(club.id);
        }
        return this.findOne(club.id);
    }
    async update(id, dto) {
        await this.findOne(id);
        await this.validateFks(dto.countryCode, dto.currentCompetitionId);
        await this.validateCompetitions(dto.competitionIds);
        const { competitionIds, ...clubData } = dto;
        await this.prisma.$transaction(async (tx) => {
            if (Object.keys(clubData).length > 0) {
                await tx.club.update({ where: { id }, data: clubData });
            }
            if (competitionIds !== undefined) {
                await tx.clubCompetition.deleteMany({ where: { clubId: id } });
                if (competitionIds.length > 0) {
                    await tx.clubCompetition.createMany({
                        data: competitionIds.map(compId => ({
                            clubId: id,
                            competitionId: compId
                        }))
                    });
                }
            }
        });
        if (competitionIds !== undefined) {
            await this.clubDenormService.regenerateForClub(id);
        }
        return this.findOne(id);
    }
    async remove(id) {
        await this.findOne(id);
        try {
            return await this.prisma.club.delete({ where: { id } });
        }
        catch (error) {
            if (error.code === 'P2003') {
                throw new common_1.ConflictException('Cannot delete: this club is still referenced by other records (e.g., players).');
            }
            throw error;
        }
    }
};
exports.AdminClubsService = AdminClubsService;
exports.AdminClubsService = AdminClubsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        club_denorm_service_1.ClubDenormService])
], AdminClubsService);
//# sourceMappingURL=clubs.service.js.map