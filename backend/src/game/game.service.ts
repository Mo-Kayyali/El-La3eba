import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(private readonly prisma: PrismaService) {}

  async guessPlayer(guessName: string) {
    const normalizedGuess = guessName.trim();
    const guessLen = normalizedGuess.length;
    if (guessLen < 3) return null;

    let allowedTypos = 0;
    if (guessLen >= 8) allowedTypos = 2;
    else if (guessLen >= 5) allowedTypos = 1;

    const matches = await this.prisma.$queryRaw<any[]>`
      WITH guess AS (
        SELECT lower(unaccent(${normalizedGuess})) AS val
      ),
      player_metrics AS (
        SELECT 
          p.*,
          -- Distance to full name
          levenshtein(lower(unaccent(p.name)), g.val) as full_dist,
          -- Min distance to any of the words in the name
          (SELECT min(levenshtein(word, g.val)) FROM unnest(string_to_array(lower(unaccent(p.name)), ' ')) as word) as word_dist,
          -- Trigram word similarity
          word_similarity(g.val, lower(unaccent(p.name))) as w_sim,
          -- Strict length checks (full name + best-matching word)
          abs(char_length(g.val) - char_length(lower(unaccent(p.name)))) as full_len_diff,
          (
            SELECT min(abs(char_length(g.val) - char_length(word)))
            FROM unnest(string_to_array(lower(unaccent(p.name)), ' ')) as word
          ) as word_len_diff
        FROM "FootballPlayer" p, guess g
      )
      SELECT *
      FROM player_metrics
      WHERE 
        -- Reject obvious length mismatches (prevents "messssssssssi" style matches)
        (full_len_diff <= 3 OR word_len_diff <= 3)
        AND
        (
          -- Require BOTH a reasonably close edit distance AND strong trigram similarity
          ((full_dist <= ${allowedTypos} OR word_dist <= ${allowedTypos}) AND w_sim >= 0.85)
          -- Or allow very high similarity (near-exact) even if levenshtein is noisy due to accents
          OR (w_sim >= 0.92 AND full_len_diff <= 2)
        )
      ORDER BY 
        w_sim DESC,
        word_dist ASC,
        full_dist ASC
      LIMIT 1;
    `;

    return matches.length > 0 ? matches[0] : null;
  }
}
