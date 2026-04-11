import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// AI REFEREE BLUEPRINT — uncomment when activating:
// import axios from 'axios';
// (also move `axios` from devDependencies to dependencies in package.json)

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

  // ─── AI Referee Blueprint ─────────────────────────────────────────────────
  //
  // When the Python microservice at http://localhost:8000 is ready:
  //   1. Move `axios` from devDependencies → dependencies in package.json.
  //   2. Uncomment the import at the top of this file.
  //   3. Uncomment this method.
  //   4. In game.gateway.ts replace every:
  //        this.gameService.guessPlayer(guessName)
  //      with:
  //        this.gameService.verifyGuessWithAI(state.currentQuestion, guessName)
  //
  // The Python service must accept:
  //   POST /evaluate
  //   Body: { question: { clue: string; answer: string }, guess: string }
  //   Response: { correct: boolean; canonical_name: string | null }
  //
  // async verifyGuessWithAI(
  //   question: { clue: string; answer: string },
  //   guessName: string,
  // ): Promise<{ name: string } | null> {
  //   try {
  //     const response = await axios.post<{
  //       correct: boolean;
  //       canonical_name: string | null;
  //     }>('http://localhost:8000/evaluate', { question, guess: guessName }, { timeout: 3000 });
  //
  //     if (response.data.correct && response.data.canonical_name) {
  //       return { name: response.data.canonical_name };
  //     }
  //     return null;
  //   } catch {
  //     // AI service unavailable — fall back to local fuzzy match so the game never breaks.
  //     return this.guessPlayer(guessName);
  //   }
  // }
}
