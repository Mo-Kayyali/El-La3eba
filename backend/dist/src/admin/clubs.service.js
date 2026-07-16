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
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateClubDto.prototype, "logoUrl", void 0);
class UpdateClubDto {
    name;
    aliases;
    countryCode;
    currentCompetitionId;
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
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateClubDto.prototype, "logoUrl", void 0);
let AdminClubsService = class AdminClubsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
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
    async findAll() {
        return this.prisma.club.findMany({
            orderBy: { name: 'asc' },
        });
    }
    async findOne(id) {
        const club = await this.prisma.club.findUnique({ where: { id } });
        if (!club)
            throw new common_1.NotFoundException('Club not found');
        return club;
    }
    async create(dto) {
        await this.validateFks(dto.countryCode, dto.currentCompetitionId);
        return this.prisma.club.create({ data: dto });
    }
    async update(id, dto) {
        await this.findOne(id);
        await this.validateFks(dto.countryCode, dto.currentCompetitionId);
        return this.prisma.club.update({ where: { id }, data: dto });
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
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminClubsService);
//# sourceMappingURL=clubs.service.js.map