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
