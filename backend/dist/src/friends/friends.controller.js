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
exports.FriendsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const friends_service_1 = require("./friends.service");
const send_friend_request_dto_1 = require("./dto/send-friend-request.dto");
let FriendsController = class FriendsController {
    friendsService;
    constructor(friendsService) {
        this.friendsService = friendsService;
    }
    sendFriendRequest(req, dto) {
        return this.friendsService.sendFriendRequest(req.user.userId, dto.identifier);
    }
    acceptFriendRequest(req, requestId) {
        return this.friendsService.acceptFriendRequest(req.user.userId, requestId);
    }
    rejectFriendRequest(req, requestId) {
        return this.friendsService.rejectFriendRequest(req.user.userId, requestId);
    }
    cancelOutgoingRequest(req, requestId) {
        return this.friendsService.cancelOutgoingRequest(req.user.userId, requestId);
    }
    removeFriend(req, friendshipId) {
        return this.friendsService.removeFriend(req.user.userId, friendshipId);
    }
    listFriends(req) {
        return this.friendsService.getFriendsList(req.user.userId);
    }
};
exports.FriendsController = FriendsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Send a friend request by UUID or username' }),
    (0, common_1.Post)('request'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, send_friend_request_dto_1.SendFriendRequestDto]),
    __metadata("design:returntype", void 0)
], FriendsController.prototype, "sendFriendRequest", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Accept a pending friend request' }),
    (0, common_1.Post)(':requestId/accept'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('requestId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FriendsController.prototype, "acceptFriendRequest", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Reject a pending friend request' }),
    (0, common_1.Post)(':requestId/reject'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('requestId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FriendsController.prototype, "rejectFriendRequest", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Cancel your outgoing friend request' }),
    (0, common_1.Post)(':requestId/cancel'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('requestId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FriendsController.prototype, "cancelOutgoingRequest", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Remove an accepted friend' }),
    (0, common_1.Post)(':friendshipId/remove'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('friendshipId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FriendsController.prototype, "removeFriend", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List friends and pending requests' }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FriendsController.prototype, "listFriends", null);
exports.FriendsController = FriendsController = __decorate([
    (0, swagger_1.ApiTags)('Friends'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('friends'),
    __metadata("design:paramtypes", [friends_service_1.FriendsService])
], FriendsController);
//# sourceMappingURL=friends.controller.js.map