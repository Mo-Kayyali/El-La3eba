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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminClubsController = void 0;
const common_1 = require("@nestjs/common");
const clubs_service_1 = require("./clubs.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
let AdminClubsController = class AdminClubsController {
    clubsService;
    constructor(clubsService) {
        this.clubsService = clubsService;
    }
    create(createDto, req) {
        return this.clubsService.create(createDto, req.user.userId);
    }
    findAll(competitionId, countryCode, search, page, limit, sort, order) {
        return this.clubsService.findAll({
            competitionId,
            countryCode,
            search,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 50,
            sort,
            order,
        });
    }
    findOne(id) {
        return this.clubsService.findOne(id);
    }
    update(id, updateDto, req) {
        return this.clubsService.update(id, updateDto, req.user.userId);
    }
    remove(id) {
        return this.clubsService.remove(id);
    }
};
exports.AdminClubsController = AdminClubsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [clubs_service_1.CreateClubDto, Object]),
    __metadata("design:returntype", void 0)
], AdminClubsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('competitionId')),
    __param(1, (0, common_1.Query)('countryCode')),
    __param(2, (0, common_1.Query)('search')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('limit')),
    __param(5, (0, common_1.Query)('sort')),
    __param(6, (0, common_1.Query)('order')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminClubsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminClubsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, clubs_service_1.UpdateClubDto, Object]),
    __metadata("design:returntype", void 0)
], AdminClubsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminClubsController.prototype, "remove", null);
exports.AdminClubsController = AdminClubsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Controller)('admin/clubs'),
    __metadata("design:paramtypes", [clubs_service_1.AdminClubsService])
], AdminClubsController);
//# sourceMappingURL=clubs.controller.js.map