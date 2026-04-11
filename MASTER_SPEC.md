# EL-LA3EBA: AI Developer Guidelines & Master Spec

## 1. Project Overview

"El-La3eba" is a production-grade, real-time multiplayer football quiz game.

- **Core Loop:** Turn-based, 10-second timer, 1v1 matchmaking. Best-of-3 rounds. 3 strikes = round loss.
- **Modes:** Ranked (MMR-based), Unrated, Private Rooms.
- **Tech Stack:** Next.js (Zustand, Tailwind), NestJS (WebSockets, REST), PostgreSQL (Prisma), Redis (Upstash).

## 2. STRICT AI Developer Rules (NEVER DO THESE):

1. **Never break Redis Atomicity:** Always use `WATCH` and `MULTI/EXEC` transactions when updating shared game state or matchmaking queues. Prevent race conditions.
2. **Never leak memory:** Ensure all `setTimeout`, `setInterval`, and Socket event listeners are properly cleared/removed on component unmount (React) or socket disconnect (NestJS).
3. **Never block the Event Loop:** Do not use heavy synchronous operations in NestJS. Always use async/await.
4. **Never expose sensitive data:** Do not send password hashes or sensitive JWT secrets to the frontend.
5. **Never break Next.js Strict Mode:** Ensure all WebSocket connections in React use singletons (Zustand) to prevent double-connections on re-renders.
6. **Never drop the UX:** If an error occurs, catch it gracefully and emit an error event to the client to display a toast, rather than crashing the server.

## 3. Current Architecture State

- **Database:** `User` (id, email, username, mmr, wins, gamesPlayed). `FootballPlayer` (id, name, `aliases` text[], clubs, activeYear). **Indexes:** B-tree on `User.mmr` for leaderboard-style reads; GIN + `pg_trgm` (`gin_trgm_ops`) on `FootballPlayer.name` and on `array_to_string(aliases, ' ')` for fast fuzzy name / alias search.
- **Matchmaking:** Lazy deletion sets + lists. `ranked_queue`, `unrated_queue`. New matches get Redis game state from `MatchmakingService.initializeGameState`, which loads each player’s current `mmr` from Postgres and stores it as `playerMmr` in the serialized state so clients can render **rank badges** in-game.
- **Rank badges (MMR → tier):** Shared helper `frontend/lib/rank.ts` — Bronze 0–999, Silver 1000–1499, Gold 1500–1999, Diamond 2000+ (Tailwind text/border/glow classes). Used on the lobby navbar and leaderboard and on left/right player cards on the game page.
- **WebSocket / game gateway:** **15s reconnection resilience** — on disconnect, a per `(gameSessionId, userId)` grace timer starts; the room receives `playerDisconnected` until `joinGameRoom` clears the timer and emits `playerReconnected` (match still in progress). **Guess rate limit:** sliding window (5 guesses / 1s per user) on `submitGuess` to absorb bursts.
- **State Management:** Redis JSON structures locked by `gameSessionId`.
- **Fuzzy Search:** Uses `pg_trgm`, `unaccent`, and `levenshtein` (`fuzzystrmatch`) in Prisma `$queryRaw` against `FootballPlayer` rows; trigram GIN indexes back substring / similarity-style workloads on `name` and flattened `aliases`.

## 4. Upgrading the Spec

_Whenever a new major feature is completed, summarize it and add it to this document so future AI prompts have full context._
