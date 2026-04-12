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
- **Matchmaking timeouts:** Queue searches and private rooms are now **strictly 60s**. Queue entries are backed by `queue_search:{userId}` (EX 60); expiry clears queue membership and emits `searchExpired`. Private rooms (`private_room:{code}` + `user_room:{userId}`) use EX 60; host expiry cleanup emits `roomExpired`.
- **Rank badges (MMR → tier):** Shared helper `frontend/lib/rank.ts` — Bronze 0–999, Silver 1000–1499, Gold 1500–1999, Diamond 2000+ (Tailwind text/border/glow classes). Used on the lobby navbar and leaderboard and on left/right player cards on the game page. The lobby sidebar includes a **Rank Tiers** legend (`RankTierLegend`) spelling out those ranges for players.
- **Auth / session hydration:** Zustand `persist` uses `skipHydration: true` plus a `bootstrapped` flag in `frontend/lib/auth-store.ts`. `AuthSessionProvider` rehydrates from `localStorage`, syncs `axios` default `Authorization`, then calls `GET /auth/me` when a token exists before marking `bootstrapped` true — protected routes wait on this so a hard refresh does not flash “logged out”. `/auth/me` now includes `pendingIncomingFriendRequests`, which is pushed into `notificationStore` during bootstrap so the navbar badge hydrates immediately on login. Shared REST helpers live in `frontend/lib/api.ts` (Bearer interceptor + `refreshAuthProfile()`).
- **WebSocket / game gateway:** **15s reconnection resilience** — on disconnect, a per `(gameSessionId, userId)` grace timer starts; the room receives `playerDisconnected` until `joinGameRoom` clears the timer and emits `playerReconnected` (match still in progress). **Guess rate limit:** sliding window (5 guesses / 1s per user) on `submitGuess` to absorb bursts. Invite lifecycle now has strict 60s rollback behavior; `inviteCancelledBySystem` is emitted for `invite_expired`, inviter offline/in-game, and invitee offline/in-game transitions so inviter UI can deterministically revert.
- **Post-match UX:** `matchOver` always includes an explicit boolean `forfeit` (`true` for manual disconnect-forfeit or `forfeitMatch`; `false` for normal endings). Manual forfeits also send `forfeitedByUserId`; disconnect-forfeit sends `disconnectedUserId` and `forfeitedByUserId`. After `status === 'match_completed'`, clients may emit `leaveEndedMatch` with `{ gameSessionId }`; the server broadcasts `opponentLeft` to the room. If a socket disconnects while the Redis game is already `match_completed`, the gateway emits `opponentLeft` **without** starting a disconnect grace timer (so finished games do not re-trigger forfeit logic).
- **State Management:** Redis JSON structures locked by `gameSessionId`.
- **Fuzzy Search:** Uses `pg_trgm`, `unaccent`, and `levenshtein` (`fuzzystrmatch`) in Prisma `$queryRaw` against `FootballPlayer` rows; trigram GIN indexes back substring / similarity-style workloads on `name` and flattened `aliases`.
- **Leaderboard cache:** `LeaderboardService` refreshes the Redis `global_leaderboard` key on a **10-minute** cron (`CronExpression.EVERY_10_MINUTES`). The lobby refetches `GET /auth/me` on each visit so the navbar tier tracks fresh `user.mmr` after matches.
- **Friends + presence:** Friendship rows are stored in Prisma as directional `Friendship` records (`PENDING` / `ACCEPTED`) between two `User` rows. `GET /friends` returns accepted friends plus incoming/outgoing requests; `POST /friends/request`, `POST /friends/:id/accept`, `POST /friends/:id/reject`, `POST /friends/:id/cancel`, and `POST /friends/:id/remove` power the REST flow. Redis now keeps `presence` hash entries per user (`online`, `in-game:{gameSessionId}`), and the WebSocket gateway periodically emits `friendsPresenceUpdated` to each user’s personal room. The friends page uses this to render live Online / Offline / In-Game indicators, disables new invites unless a friend is online, and supports Remove Friend / Cancel Request actions.
- **Private room cleanup:** Cancelling a private room deletes both `user_room:{userId}` and `private_room:{code}`. Joining a private room uses Redis WATCH + MULTI/EXEC around `private_room:{code}` so a stale code is rejected if the host cancels during the join race. Disconnect and in-game transitions now aggressively clear user queue state, hosted rooms, outgoing invites, and incoming invites.

## 4. Upgrading the Spec

_Whenever a new major feature is completed, summarize it and add it to this document so future AI prompts have full context._
