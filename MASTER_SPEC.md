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

- **Database:** `User` (id, email, username, mmr, wins), `FootballPlayer` (id, name, aliases).
- **Matchmaking:** Lazy deletion sets + lists. `ranked_queue`, `unrated_queue`.
- **State Management:** Redis JSON structures locked by `gameSessionId`.
- **Fuzzy Search:** Uses `pg_trgm` (similarity, levenshtein) directly in Prisma `$queryRaw`.

## 4. Upgrading the Spec

_Whenever a new major feature is completed, summarize it and add it to this document so future AI prompts have full context._
