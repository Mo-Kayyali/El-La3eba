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
exports.AdminPlayersService = exports.PatchPlayerDto = exports.UpdatePlayerDto = exports.CreatePlayerDto = exports.ClubHistoryDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const player_denorm_service_1 = require("../game/player-denorm.service");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class ClubHistoryDto {
    clubId;
    startYear;
    endYear;
    isCurrent;
}
exports.ClubHistoryDto = ClubHistoryDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ClubHistoryDto.prototype, "clubId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ClubHistoryDto.prototype, "startYear", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], ClubHistoryDto.prototype, "endYear", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ClubHistoryDto.prototype, "isCurrent", void 0);
class CreatePlayerDto {
    firstName;
    lastName;
    name;
    aliases;
    nationality;
    dateOfBirth;
    heightCm;
    preferredFoot;
    positions;
    primaryPosition;
    isRetired;
    currentClubId;
    imageUrl;
}
exports.CreatePlayerDto = CreatePlayerDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreatePlayerDto.prototype, "aliases", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "nationality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreatePlayerDto.prototype, "heightCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PreferredFoot),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "preferredFoot", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.Position, { each: true }),
    __metadata("design:type", Array)
], CreatePlayerDto.prototype, "positions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Position),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "primaryPosition", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePlayerDto.prototype, "isRetired", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "currentClubId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePlayerDto.prototype, "imageUrl", void 0);
class UpdatePlayerDto extends CreatePlayerDto {
}
exports.UpdatePlayerDto = UpdatePlayerDto;
class PatchPlayerDto {
    firstName;
    lastName;
    name;
    aliases;
    nationality;
    dateOfBirth;
    heightCm;
    preferredFoot;
    positions;
    primaryPosition;
    isRetired;
    currentClubId;
    imageUrl;
    clubHistory;
}
exports.PatchPlayerDto = PatchPlayerDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PatchPlayerDto.prototype, "aliases", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "nationality", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "dateOfBirth", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], PatchPlayerDto.prototype, "heightCm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.PreferredFoot),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "preferredFoot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.Position, { each: true }),
    __metadata("design:type", Array)
], PatchPlayerDto.prototype, "positions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Position),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "primaryPosition", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PatchPlayerDto.prototype, "isRetired", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "currentClubId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PatchPlayerDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ClubHistoryDto),
    __metadata("design:type", Array)
], PatchPlayerDto.prototype, "clubHistory", void 0);
let AdminPlayersService = class AdminPlayersService {
    prisma;
    playerDenormService;
    constructor(prisma, playerDenormService) {
        this.prisma = prisma;
        this.playerDenormService = playerDenormService;
    }
    async validateFks(nationality, currentClubId, clubHistory) {
        if (nationality) {
            const country = await this.prisma.country.findUnique({ where: { id: nationality } });
            if (!country)
                throw new common_1.BadRequestException(`Nationality code '${nationality}' does not exist.`);
        }
        if (currentClubId) {
            const club = await this.prisma.club.findUnique({ where: { id: currentClubId } });
            if (!club)
                throw new common_1.BadRequestException(`Club ID '${currentClubId}' does not exist.`);
        }
        if (clubHistory) {
            for (const history of clubHistory) {
                const club = await this.prisma.club.findUnique({ where: { id: history.clubId } });
                if (!club)
                    throw new common_1.BadRequestException(`History Club ID '${history.clubId}' does not exist.`);
            }
        }
    }
    async findAll() {
        return this.prisma.player.findMany({
            orderBy: { name: 'asc' },
            include: {
                currentClub: { select: { id: true, name: true, logoUrl: true } }
            }
        });
    }
    async findOne(id) {
        const player = await this.prisma.player.findUnique({
            where: { id },
            include: {
                currentClub: true,
                playerClubs: {
                    include: { club: true },
                    orderBy: [{ isCurrent: 'desc' }, { startYear: 'asc' }]
                }
            }
        });
        if (!player)
            throw new common_1.NotFoundException('Player not found');
        return player;
    }
    async create(dto) {
        await this.validateFks(dto.nationality, dto.currentClubId);
        let aliases = dto.aliases;
        if (!aliases || aliases.length === 0) {
            aliases = [dto.firstName, dto.lastName].filter(Boolean);
        }
        return this.prisma.player.create({
            data: {
                ...dto,
                aliases,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            }
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        await this.validateFks(dto.nationality, dto.currentClubId, dto.clubHistory);
        const { clubHistory, dateOfBirth, ...playerData } = dto;
        const dataToUpdate = { ...playerData };
        if (dateOfBirth !== undefined) {
            dataToUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
        }
        await this.prisma.$transaction(async (tx) => {
            if (Object.keys(dataToUpdate).length > 0) {
                await tx.player.update({ where: { id }, data: dataToUpdate });
            }
            if (clubHistory !== undefined) {
                await tx.playerClub.deleteMany({ where: { playerId: id } });
                if (clubHistory.length > 0) {
                    await tx.playerClub.createMany({
                        data: clubHistory.map(ch => ({
                            playerId: id,
                            clubId: ch.clubId,
                            startYear: ch.startYear,
                            endYear: ch.endYear,
                            isCurrent: ch.isCurrent
                        }))
                    });
                }
            }
        });
        if (clubHistory !== undefined) {
            await this.playerDenormService.regenerateForPlayer(id);
        }
        return this.findOne(id);
    }
    async remove(id) {
        await this.findOne(id);
        try {
            return await this.prisma.player.delete({ where: { id } });
        }
        catch (error) {
            if (error.code === 'P2003') {
                throw new common_1.ConflictException('Cannot delete: this player is still referenced by questions or answers.');
            }
            throw error;
        }
    }
};
exports.AdminPlayersService = AdminPlayersService;
exports.AdminPlayersService = AdminPlayersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        player_denorm_service_1.PlayerDenormService])
], AdminPlayersService);
//# sourceMappingURL=players.service.js.map