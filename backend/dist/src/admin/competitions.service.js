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
exports.AdminCompetitionsService = exports.UpdateCompetitionDto = exports.CreateCompetitionDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
class CreateCompetitionDto {
    name;
    type;
    countryCode;
    region;
    tier;
}
exports.CreateCompetitionDto = CreateCompetitionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompetitionDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(client_1.CompetitionType),
    __metadata("design:type", String)
], CreateCompetitionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateCompetitionDto.prototype, "countryCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Region),
    __metadata("design:type", String)
], CreateCompetitionDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateCompetitionDto.prototype, "tier", void 0);
class UpdateCompetitionDto {
    name;
    type;
    countryCode;
    region;
    tier;
}
exports.UpdateCompetitionDto = UpdateCompetitionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCompetitionDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.CompetitionType),
    __metadata("design:type", String)
], UpdateCompetitionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCompetitionDto.prototype, "countryCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.Region),
    __metadata("design:type", String)
], UpdateCompetitionDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateCompetitionDto.prototype, "tier", void 0);
let AdminCompetitionsService = class AdminCompetitionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(filters = {}) {
        const where = {};
        const page = filters.page || 1;
        const limit = filters.limit || 50;
        const skip = (page - 1) * limit;
        if (filters.countryCode) {
            if (filters.countryCode === '_WORLD') {
                where.type = { in: ['INTERNATIONAL_TOURNAMENT', 'GLOBAL_CLUB_CHAMPIONSHIP', 'INTERNATIONAL'] };
            }
            else if (filters.countryCode === '_CONTINENTAL') {
                where.type = { in: ['CONTINENTAL_CLUB_COMPETITION', 'CONTINENTAL_SUPER_CUP', 'CONTINENTAL_CLUB'] };
            }
            else {
                where.countryCode = filters.countryCode;
            }
        }
        if (filters.search) {
            const normalizedSearch = filters.search.trim();
            if (normalizedSearch.length <= 2) {
                where.name = { contains: normalizedSearch, mode: 'insensitive' };
            }
            else {
                const [_, matchedIdsObj] = await this.prisma.$transaction([
                    this.prisma.$executeRawUnsafe(`SET LOCAL pg_trgm.word_similarity_threshold = 0.5;`),
                    this.prisma.$queryRaw `
            SELECT c.id
            FROM "Competition" c
            WHERE lower(unaccent_immutable(c.name)) %> lower(unaccent(${normalizedSearch}))
            ORDER BY word_similarity(lower(unaccent(${normalizedSearch})), lower(unaccent_immutable(c.name))) DESC
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
        const total = await this.prisma.competition.count({ where });
        let orderBy = { name: 'asc' };
        if (filters.sort) {
            const validSorts = ['name', 'createdAt', 'type', 'tier'];
            if (validSorts.includes(filters.sort)) {
                orderBy = { [filters.sort]: filters.order === 'desc' ? 'desc' : 'asc' };
            }
            else if (filters.sort === 'location') {
                orderBy = [
                    { countryCode: filters.order === 'desc' ? 'desc' : 'asc' },
                    { region: filters.order === 'desc' ? 'desc' : 'asc' }
                ];
            }
        }
        const data = await this.prisma.competition.findMany({
            where,
            skip,
            take: limit,
            orderBy,
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
        const comp = await this.prisma.competition.findUnique({ where: { id } });
        if (!comp)
            throw new common_1.NotFoundException('Competition not found');
        return comp;
    }
    validateRules(type, countryCode, region) {
        if ([
            client_1.CompetitionType.DOMESTIC_LEAGUE,
            client_1.CompetitionType.DOMESTIC_CUP,
            client_1.CompetitionType.DOMESTIC_SUPER_CUP,
        ].includes(type)) {
            if (!countryCode)
                throw new common_1.BadRequestException('Domestic competitions require a countryCode.');
            if (region)
                throw new common_1.BadRequestException('Domestic competitions cannot have a region.');
        }
        else if ([
            client_1.CompetitionType.CONTINENTAL_CLUB_COMPETITION,
            client_1.CompetitionType.CONTINENTAL_SUPER_CUP,
        ].includes(type)) {
            if (!region || region === client_1.Region.WORLD) {
                throw new common_1.BadRequestException('Continental competitions require a valid continent region (not WORLD).');
            }
            if (countryCode)
                throw new common_1.BadRequestException('Continental competitions cannot have a countryCode.');
        }
        else if ([
            client_1.CompetitionType.INTERNATIONAL_TOURNAMENT,
            client_1.CompetitionType.GLOBAL_CLUB_CHAMPIONSHIP,
        ].includes(type)) {
            if (!region)
                throw new common_1.BadRequestException('International/Global competitions require a region.');
            if (countryCode)
                throw new common_1.BadRequestException('International/Global competitions cannot have a countryCode.');
        }
    }
    async create(dto, adminUserId) {
        this.validateRules(dto.type, dto.countryCode, dto.region);
        return this.prisma.competition.create({ data: { ...dto, createdBy: adminUserId } });
    }
    async update(id, dto, adminUserId) {
        const comp = await this.findOne(id);
        const newType = dto.type !== undefined ? dto.type : comp.type;
        const newCountryCode = dto.countryCode !== undefined ? dto.countryCode : comp.countryCode;
        const newRegion = dto.region !== undefined ? dto.region : comp.region;
        this.validateRules(newType, newCountryCode, newRegion);
        const updateData = { ...dto };
        if ([client_1.CompetitionType.DOMESTIC_LEAGUE, client_1.CompetitionType.DOMESTIC_CUP, client_1.CompetitionType.DOMESTIC_SUPER_CUP].includes(newType)) {
            updateData.region = null;
        }
        else {
            updateData.countryCode = null;
        }
        updateData.createdBy = adminUserId;
        return this.prisma.competition.update({ where: { id }, data: updateData });
    }
    async remove(id) {
        await this.findOne(id);
        try {
            return await this.prisma.competition.delete({ where: { id } });
        }
        catch (error) {
            if (error.code === 'P2003') {
                throw new common_1.ConflictException('Cannot delete: this competition is still referenced by other records (e.g., clubs).');
            }
            throw error;
        }
    }
};
exports.AdminCompetitionsService = AdminCompetitionsService;
exports.AdminCompetitionsService = AdminCompetitionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminCompetitionsService);
//# sourceMappingURL=competitions.service.js.map