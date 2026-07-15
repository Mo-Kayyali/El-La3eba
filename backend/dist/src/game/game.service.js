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
        const normalizedGuess = guessName.trim();
        const guessLen = normalizedGuess.length;
        if (guessLen < 3)
            return null;
        let allowedTypos = 0;
        if (guessLen >= 8)
            allowedTypos = 2;
        else if (guessLen >= 5)
            allowedTypos = 1;
        const matches = await this.prisma.$queryRaw `
      WITH guess AS (
        SELECT lower(unaccent(${normalizedGuess})) AS val
      ),
      player_metrics AS (
        SELECT 
          p.*,
          g.val,
          -- Best edit distance to the FULL name or any FULL alias within length tolerance
          (
            SELECT min(levenshtein(lower(unaccent(alias)), g.val))
            FROM unnest(array_append(p.aliases, p.name)) as alias
            WHERE abs(char_length(g.val) - char_length(alias)) <= 3
          ) as best_dist,
          -- Trigram similarity against both name and aliases for sorting (and pre-filtering)
          GREATEST(
            word_similarity(g.val, lower(unaccent(p.name))),
            word_similarity(g.val, lower(unaccent(array_to_string(p.aliases, ' '))))
          ) as w_sim
        FROM "FootballPlayer" p, guess g
        WHERE
          -- Generous prefilter to narrow candidates via GIN index (if configured) or fast discard
          (
            word_similarity(g.val, lower(unaccent(p.name))) >= 0.15 OR
            word_similarity(g.val, lower(unaccent(array_to_string(p.aliases, ' ')))) >= 0.15
          )
      )
      SELECT *
      FROM player_metrics
      WHERE 
        best_dist <= ${allowedTypos}
      ORDER BY 
        w_sim DESC,
        best_dist ASC
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