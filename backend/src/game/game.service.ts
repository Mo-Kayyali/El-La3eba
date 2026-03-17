import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async guessPlayer(guessName: string) {
    const guessLen = guessName.length;
    let allowedTypos = 0;
    if (guessLen >= 8) allowedTypos = 2;
    else if (guessLen >= 5) allowedTypos = 1;

    const matches = await this.prisma.$queryRaw<any[]>`
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
}
