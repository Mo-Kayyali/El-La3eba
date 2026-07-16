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
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateCompetitionDto.prototype, "tier", void 0);
class UpdateCompetitionDto {
    name;
    type;
    countryCode;
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
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateCompetitionDto.prototype, "tier", void 0);
let AdminCompetitionsService = class AdminCompetitionsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.competition.findMany({
            orderBy: { name: 'asc' },
        });
    }
    async findOne(id) {
        const comp = await this.prisma.competition.findUnique({ where: { id } });
        if (!comp)
            throw new common_1.NotFoundException('Competition not found');
        return comp;
    }
    async create(dto) {
        return this.prisma.competition.create({ data: dto });
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.competition.update({ where: { id }, data: dto });
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