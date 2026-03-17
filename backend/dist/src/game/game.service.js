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
exports.GameService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let GameService = class GameService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async guessPlayer(guessName) {
        const guessLen = guessName.length;
        let allowedTypos = 0;
        if (guessLen >= 8)
            allowedTypos = 2;
        else if (guessLen >= 5)
            allowedTypos = 1;
        const matches = await this.prisma.$queryRaw `
      WITH guess AS (
        SELECT lower(unaccent(${guessName})) AS val
      ),
      player_metrics AS (
        SELECT 
          p.*,
          -- Distance to full name
          levenshtein(lower(unaccent(p.name)), g.val) as full_dist,
          -- Min distance to any of the words in the name
          (SELECT min(levenshtein(word, g.val)) FROM unnest(string_to_array(lower(unaccent(p.name)), ' ')) as word) as word_dist,
          -- Trigram word similarity
          word_similarity(g.val, lower(unaccent(p.name))) as w_sim
        FROM "FootballPlayer" p, guess g
      )
      SELECT *
      FROM player_metrics
      WHERE 
        full_dist <= ${allowedTypos}
        OR word_dist <= ${allowedTypos}
        OR w_sim >= 0.7
      ORDER BY 
        w_sim DESC,
        word_dist ASC,
        full_dist ASC
      LIMIT 1;
    `;
        return matches.length > 0 ? matches[0] : null;
    }
};
exports.GameService = GameService;
exports.GameService = GameService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GameService);
//# sourceMappingURL=game.service.js.map