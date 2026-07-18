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
const string_util_1 = require("../utils/string.util");
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
    positionCategories;
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
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsEnum)(client_1.PositionCategory, { each: true }),
    __metadata("design:type", Array)
], CreatePlayerDto.prototype, "positionCategories", void 0);
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
    positionCategories;
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
    (0, class_validator_1.IsEnum)(client_1.PositionCategory, { each: true }),
    __metadata("design:type", Array)
], PatchPlayerDto.prototype, "positionCategories", void 0);
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
    async search(query) {
        if (!query || query.length < 2)
            return [];
        return this.prisma.player.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { aliases: { hasSome: [query] } },
                ]
            },
            take: 15,
            select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                nationality: true,
                isRetired: true,
                currentClub: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' }
        });
    }
    async findAll(filters = {}) {
        const where = {};
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;
        if (filters.search) {
            const normalizedSearch = filters.search.trim();
            if (normalizedSearch.length <= 2) {
                where.name = { contains: normalizedSearch, mode: 'insensitive' };
            }
            else {
                const [_, matchedIdsObj] = await this.prisma.$transaction([
                    this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.5;`),
                    this.prisma.$queryRaw `
            SELECT p.id
            FROM "Player" p
            WHERE 
              lower(unaccent_immutable(p.name)) %> lower(unaccent(${normalizedSearch})) OR
              lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))) %> lower(unaccent(${normalizedSearch}))
            ORDER BY GREATEST(
              word_similarity(lower(unaccent(${normalizedSearch})), lower(unaccent_immutable(p.name))),
              word_similarity(lower(unaccent(${normalizedSearch})), lower(unaccent_immutable(array_to_string_immutable(p.aliases, ' '))))
            ) DESC
            LIMIT 500;
          `
                ]);
                const matchedIds = matchedIdsObj.map(row => row.id);
                if (matchedIds.length === 0) {
                    return { data: [], meta: { total: 0, page, totalPages: 0 } };
                }
                where.id = { in: matchedIds };
            }
        }
        if (filters.clubId) {
            where.currentClubId = filters.clubId;
        }
        else {
            const clubConditions = [];
            if (filters.competitionId) {
                clubConditions.push({
                    OR: [
                        { currentCompetitionId: filters.competitionId },
                        { clubCompetitions: { some: { competitionId: filters.competitionId } } }
                    ]
                });
            }
            if (filters.compCountryCode) {
                let compCondition;
                if (filters.compCountryCode === '_WORLD') {
                    compCondition = { type: { in: ['INTERNATIONAL_TOURNAMENT', 'GLOBAL_CLUB_CHAMPIONSHIP'] } };
                }
                else if (filters.compCountryCode === '_CONTINENTAL') {
                    compCondition = { type: { in: ['CONTINENTAL_CLUB_COMPETITION', 'CONTINENTAL_SUPER_CUP'] } };
                }
                else {
                    compCondition = { countryCode: filters.compCountryCode };
                }
                clubConditions.push({
                    OR: [
                        { currentCompetition: compCondition },
                        { clubCompetitions: { some: { competition: compCondition } } }
                    ]
                });
            }
            if (clubConditions.length > 0) {
                where.currentClub = { AND: clubConditions };
            }
        }
        if (filters.isRetired !== undefined && filters.isRetired !== '') {
            where.isRetired = filters.isRetired === 'true';
        }
        if (filters.nationality) {
            where.nationality = filters.nationality;
        }
        const total = await this.prisma.player.count({ where });
        let orderBy = { name: 'asc' };
        if (filters.sort) {
            const validSorts = ['name', 'createdAt', 'isRetired', 'nationality'];
            if (validSorts.includes(filters.sort)) {
                orderBy = { [filters.sort]: filters.order === 'desc' ? 'desc' : 'asc' };
            }
            else if (filters.sort === 'currentClub') {
                orderBy = { currentClub: { name: filters.order === 'desc' ? 'desc' : 'asc' } };
            }
        }
        const data = await this.prisma.player.findMany({
            where,
            skip,
            take: limit,
            orderBy,
            include: {
                currentClub: { select: { id: true, name: true, logoUrl: true } }
            }
        });
        return {
            data,
            meta: {
                total,
                page,
                totalPages: Math.ceil(total / limit)
            }
        };
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
    async create(dto, adminUserId) {
        if (dto.firstName)
            dto.firstName = (0, string_util_1.capitalizeWords)(dto.firstName);
        if (dto.lastName)
            dto.lastName = (0, string_util_1.capitalizeWords)(dto.lastName);
        if (dto.name)
            dto.name = (0, string_util_1.capitalizeWords)(dto.name);
        await this.validateFks(dto.nationality, dto.currentClubId);
        let aliases = dto.aliases;
        if (!aliases || aliases.length === 0) {
            aliases = [dto.firstName, dto.lastName].filter(Boolean);
        }
        const player = await this.prisma.player.create({
            data: {
                ...dto,
                aliases,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
                createdBy: adminUserId,
            }
        });
        if (player.currentClubId) {
            await this.prisma.playerClub.create({
                data: {
                    playerId: player.id,
                    clubId: player.currentClubId,
                    isCurrent: true,
                }
            });
            await this.playerDenormService.regenerateForPlayer(player.id);
        }
        return player;
    }
    async update(id, dto, adminUserId) {
        if (dto.firstName)
            dto.firstName = (0, string_util_1.capitalizeWords)(dto.firstName);
        if (dto.lastName)
            dto.lastName = (0, string_util_1.capitalizeWords)(dto.lastName);
        if (dto.name)
            dto.name = (0, string_util_1.capitalizeWords)(dto.name);
        await this.findOne(id);
        await this.validateFks(dto.nationality, dto.currentClubId, dto.clubHistory);
        const { clubHistory, dateOfBirth, ...playerData } = dto;
        const dataToUpdate = { ...playerData, createdBy: adminUserId };
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
            const currentClubId = 'currentClubId' in dataToUpdate ? dataToUpdate.currentClubId : (await tx.player.findUnique({ where: { id }, select: { currentClubId: true } }))?.currentClubId;
            if (currentClubId) {
                await tx.playerClub.updateMany({
                    where: { playerId: id, isCurrent: true, clubId: { not: currentClubId } },
                    data: { isCurrent: false }
                });
                const existing = await tx.playerClub.findFirst({
                    where: { playerId: id, clubId: currentClubId }
                });
                if (existing) {
                    if (!existing.isCurrent) {
                        await tx.playerClub.update({
                            where: { id: existing.id },
                            data: { isCurrent: true }
                        });
                    }
                }
                else {
                    await tx.playerClub.create({
                        data: { playerId: id, clubId: currentClubId, isCurrent: true }
                    });
                }
            }
            else {
                await tx.playerClub.updateMany({
                    where: { playerId: id, isCurrent: true },
                    data: { isCurrent: false }
                });
            }
        });
        await this.playerDenormService.regenerateForPlayer(id);
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