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
exports.AdminPlayersController = void 0;
const common_1 = require("@nestjs/common");
const players_service_1 = require("./players.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const client_1 = require("@prisma/client");
let AdminPlayersController = class AdminPlayersController {
    playersService;
    constructor(playersService) {
        this.playersService = playersService;
    }
    create(createDto, req) {
        return this.playersService.create(createDto, req.user.userId);
    }
    findAll(competitionId, compCountryCode, clubId, isRetired, nationality, search, page, limit, sort, order) {
        return this.playersService.findAll({
            competitionId, compCountryCode, clubId, isRetired, nationality, search,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 50,
            sort, order,
        });
    }
    search(q) {
        return this.playersService.search(q);
    }
    findOne(id) {
        return this.playersService.findOne(id);
    }
    update(id, updateDto, req) {
        return this.playersService.update(id, updateDto, req.user.userId);
    }
    remove(id) {
        return this.playersService.remove(id);
    }
};
exports.AdminPlayersController = AdminPlayersController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [players_service_1.CreatePlayerDto, Object]),
    __metadata("design:returntype", void 0)
], AdminPlayersController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('competitionId')),
    __param(1, (0, common_1.Query)('compCountryCode')),
    __param(2, (0, common_1.Query)('clubId')),
    __param(3, (0, common_1.Query)('isRetired')),
    __param(4, (0, common_1.Query)('nationality')),
    __param(5, (0, common_1.Query)('search')),
    __param(6, (0, common_1.Query)('page')),
    __param(7, (0, common_1.Query)('limit')),
    __param(8, (0, common_1.Query)('sort')),
    __param(9, (0, common_1.Query)('order')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], AdminPlayersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('search'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPlayersController.prototype, "search", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPlayersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, players_service_1.PatchPlayerDto, Object]),
    __metadata("design:returntype", void 0)
], AdminPlayersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AdminPlayersController.prototype, "remove", null);
exports.AdminPlayersController = AdminPlayersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Controller)('admin/players'),
    __metadata("design:paramtypes", [players_service_1.AdminPlayersService])
], AdminPlayersController);
//# sourceMappingURL=players.controller.js.map