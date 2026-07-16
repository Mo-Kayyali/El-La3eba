# EL-LA3EBA: AI Developer Guidelines & Master Spec

> **Read this file first, every session, before touching any code.**
> This document describes what is ALREADY BUILT and WORKING. Treat everything in
> here as ground truth about the current system, not aspirational. If your
> change conflicts with something described here, stop and flag it instead of
> silently overriding it.
>
> For what to build next, see `GAME_DESIGN_ROADMAP.md`.
> For scalability/security invariants that apply to matchmaking, game sessions,
> and the WebSocket gateway specifically, see `SCALABILITY_SECURITY.md`.

## 1. Project Overview

"El-La3eba" is a real-time multiplayer football quiz game, in active solo
development, targeting eventual public deployment at ~1000 concurrent users.

- **Core Loop:** Turn-based, 10-second timer, 1v1 matchmaking. Best-of-3 rounds. 3 strikes = round loss.
- **Modes (current):** Ranked (MMR-based), Unrated, Private Rooms. All three currently share the same "Strikes" game mode logic.
- **Tech Stack:** Next.js (App Router, Zustand, Tailwind, Socket.io-client), NestJS (WebSockets, REST), PostgreSQL (Prisma), Redis (Upstash).

## 2. STRICT AI Developer Rules (NEVER DO THESE)

1. **Never break Redis Atomicity:** Always use `WATCH` and `MULTI/EXEC` transactions (or a Lua script, as matchmaking already does) when updating shared game state or matchmaking queues. Prevent race conditions.
2. **Never leak memory:** Ensure all `setTimeout`, `setInterval`, and Socket event listeners are properly cleared/removed on component unmount (React) or socket disconnect (NestJS).
3. **Never block the Event Loop:** Do not use heavy synchronous operations in NestJS. Always use async/await.
4. **Never expose sensitive data:** Do not send password hashes or sensitive JWT secrets to the frontend.
5. **Never break Next.js Strict Mode:** Ensure all WebSocket connections in React use singletons (Zustand) to prevent double-connections on re-renders.
6. **Never drop the UX:** If an error occurs, catch it gracefully and emit an error event to the client to display a toast, rather than crashing the server.
7. **Never assume a doc is current without checking:** these files describe the system as of their last edit. If you're about to touch matchmaking, game-session, or gateway code, verify the relevant service against this doc first — if they've drifted, update this doc as part of your change, don't just patch around the mismatch.

## 3. Database Schema (Prisma — Current)

```
User
  id                     uuid (pk)
  email                  string (unique)
  username               string (unique)
  passwordHash           string
  isVerified             boolean (default false)
  mmr                    int (default 1000)
  wins                   int
  gamesPlayed            int
  offlineDisconnectCount int (default 0)
  lastDisconnectAt       datetime?
  createdAt              datetime
  updatedAt              datetime
  // Indexes: B-tree on mmr (leaderboard reads)

FootballPlayer
  id                uuid (pk)
  name              string
  aliases           string[]
  clubs             string[]
  activeYear        int
  // Indexes: GIN + pg_trgm (gin_trgm_ops) on `name` and on
  //           array_to_string(aliases, ' ') for fuzzy name/alias search

Friendship
  id                uuid (pk)
  userId            uuid (fk -> User)
  friendId          uuid (fk -> User)
  status            enum (PENDING | ACCEPTED)
  createdAt         datetime
  updatedAt         datetime
  // Directional: userId -> friendId. Both accepted and pending
  // (incoming/outgoing) rows are read from this one table.

OfflinePenalty
  id                uuid (pk)
  userId            uuid (fk -> User)
  gameSessionId     string
  mmrLost           int          // 0 for unrated disconnect-forfeits
  acknowledgedAt    datetime?
  createdAt         datetime
  // Durable record of a disconnect-forfeit. Mirrored to Redis
  // `penalty:{userId}` for fast login hydration; acknowledged via
  // POST /auth/acknowledge-offline-penalty which also clears the Redis cache.
```

> **Known gap:** there is no `Question` model documented here yet, nor is there
> one in the database. Questions are currently hardcoded strings in
> `game.questions.ts`. Next time the question schema is touched (e.g. when adding per-question
> answer sets or the planned `game_mode` column — see `GAME_DESIGN_ROADMAP.md`),
> add the real model here so this file stays authoritative.

## 4. Current Architecture State

- **Matchmaking:** Public queues are Redis **ZSETs** keyed by mode (`ranked_queue`, `unrated_queue`) with `score = joinTimestampMs` and `member = userId`, plus companion membership sets (`*_queue_members`) and per-user metadata key `queue_search:{userId}`. Every tick runs purge-before-match (`ZREMRANGEBYSCORE ... -inf now-60000`) then atomically claims the two oldest valid users via a Lua script to avoid ghost matches and stale pops. New matches initialize through `MatchmakingService.initializeGameState`, which embeds current player `mmr` as `playerMmr` for in-game rank badges.
- **Matchmaking timeouts:** Queue searches and private rooms are **strictly 60s**. On each purge tick the server first fetches expiring userIds via `ZRANGEBYSCORE ... -inf cutoff`, emits `searchExpired` to those users, then purges queue records (`ZREMRANGEBYSCORE` + membership/meta cleanup) so the lobby spinner always resolves without per-user `setTimeout` races. Private rooms (`private_room:{code}` + `user_room:{userId}`) use EX 60; host expiry cleanup emits `roomExpired`.
- **Rank badges (MMR → tier):** Shared helper `frontend/lib/rank.ts` — Bronze 0–999, Silver 1000–1499, Gold 1500–1999, Diamond 2000+ (Tailwind text/border/glow classes). Used on the lobby navbar, leaderboard, and left/right player cards on the game page. The lobby sidebar includes a **Rank Tiers** legend (`RankTierLegend`).
- **Auth / session hydration:** Zustand `persist` uses `skipHydration: true` plus a `bootstrapped` flag in `frontend/lib/auth-store.ts`. `AuthSessionProvider` rehydrates from `localStorage`, syncs `axios` default `Authorization`, then calls `GET /auth/me` when a token exists before marking `bootstrapped` true. `/auth/me` also includes `activeGameSessionId` (from Redis `user_active_game:{userId}` with legacy fallback), `pendingIncomingFriendRequests` (hydrated into `notificationStore` at bootstrap), and `pendingOfflinePenalty` (rendered as an explicit acknowledge modal). The frontend enforces a global Active Game Lock via `router.replace('/game/{id}')` whenever `activeGameSessionId` exists, and authenticated visits to `/` route to `/lobby` when no active match lock applies. The frontend also mirrors JWT presence into cookie `el_la3eba_token` so server-side route protection can redirect before protected UI renders.
- **WebSocket / game gateway:** **30s reconnection resilience** — active matches are tracked explicitly via Redis mapping `user_active_game:{userId}` (authoritative lookup on disconnect, since Socket.io room membership is not reliable during disconnect teardown). On disconnect, the gateway reads that mapping and starts a per `(gameSessionId, userId)` grace timer while turn timers keep running; the room receives `playerDisconnected` until `joinGameRoom` clears the timer and emits `playerReconnected` for still-active matches. `joinGameRoom` fetches Redis state first, rejects reconnect attempts when `status === 'match_completed'`, and preserves the active-game mapping for resumed sessions. If grace expires, match state is finalized (`status: 'match_completed'`), the opponent is awarded the win, `matchOver` is broadcast, and an offline penalty record is persisted exactly once. The game UI shows this as a non-blocking top-center disconnect banner with a live 30-second countdown so the active player can keep playing while waiting for reconnection. Active-game mappings are deleted on normal match completion, manual forfeit, disconnect-forfeit, and end-of-match leave acknowledgement to prevent stale penalties. **Guess rate limit:** sliding window (5 guesses / 1s per user) on `submitGuess`. **Turn timers & Concurrency:** The game state stores an absolute `turnDeadlineAt` timestamp. On reconnect, the exact remaining time is computed from this deadline and included in the payload so the frontend clock reflects the true remaining time. When Redis `WATCH` transaction conflicts occur, the transaction itself retries (up to 3 attempts, ~50ms apart) without restarting the turn deadline. The timer only resets when a turn genuinely advances to the next player. **CORS configuration:** WebSocket CORS is securely driven by the `WS_ALLOWED_ORIGINS` environment variable. **Invites:** Invite lifecycle has strict 60s rollback behavior; `inviteCancelledBySystem` is emitted for `invite_expired`, inviter offline/in-game, and invitee offline/in-game transitions. Invite cleanup relies on O(1) tracking sets (e.g., `invites_sent:{userId}`) per user instead of expensive keyspace scans.
- **Offline penalty system:** Offline forfeits write durable records to Postgres (`OfflinePenalty`, see schema above) and cache the latest pending payload in Redis (`penalty:{userId}`) for fast login hydration. Ranked disconnect-forfeits persist actual MMR loss; unrated disconnect-forfeits persist `mmrLost: 0`. `GET /auth/me` surfaces `pendingOfflinePenalty` (mmrLost, gameSessionId, createdAt), and the modal copy is mode-aware (no MMR wording when `mmrLost === 0`). `POST /auth/acknowledge-offline-penalty` marks pending penalties acknowledged and clears the Redis cache.
- **Protected-route redirect:** Next.js middleware checks `el_la3eba_token` and redirects unauthenticated requests for protected paths (`/lobby`, `/friends`, `/profile`, `/game`) to `/` with no protected-page flash.
- **Post-match UX & Rematch:** `matchOver` always includes an explicit boolean `forfeit` (`true` for manual disconnect-forfeit or `forfeitMatch`; `false` for normal endings). Manual forfeits also send `forfeitedByUserId`; disconnect-forfeit sends `disconnectedUserId` and `forfeitedByUserId`. After `status === 'match_completed'`, clients may emit `leaveEndedMatch` with `{ gameSessionId }`; the server broadcasts `opponentLeft` to the room and performs defensive active-game key cleanup for the leaving user. Players can request a rematch **after any match ending (including manual forfeits)**. If the match ended via disconnect-forfeit, the frontend intercepts `disconnectedUserId` to immediately flag the opponent as having left and disable the rematch button. When both accept, the server initializes a fresh game session and synchronously updates `user_active_game:{userId}` for both players to instantly secure the active-game lock. The gateway explicitly emits a `rematchStarting` event to the *new* `gameSessionId` room, which the frontend handles by triggering a full navigation to explicitly join the new room identically to a fresh match.
- **Profile Management:** The `PATCH /users/profile` endpoint requires the `currentPassword` (validated securely via bcrypt) whenever a user attempts to change their password. The frontend profile edit UI surfaces this field unconditionally to prevent ambiguous conditional rendering.
- **State Management:** Redis JSON structures locked by `gameSessionId`.
- **Fuzzy Search:** Scales tolerance by guess length — ≤4 chars (0 typos), ≥5 (1 typo), ≥8 (2 typos). Uses `pg_trgm`, `unaccent`, and `levenshtein` (`fuzzystrmatch`) in Prisma `$queryRaw` against `FootballPlayer` rows. A generous `word_similarity` (>= 0.15) prefilter acts purely to hit the GIN indexes on `name` and flattened `aliases` without accidentally filtering out valid typos. The final accept/reject uses `levenshtein` distance strictly against the full name and any full aliases, explicitly rejecting inputs if the length difference vs. the target matched string is >3 characters.
- **Leaderboard cache:** `LeaderboardService` refreshes the Redis `global_leaderboard` key on a **10-minute** cron (`CronExpression.EVERY_10_MINUTES`). The lobby refetches `GET /auth/me` on each visit so the navbar tier tracks fresh `user.mmr` after matches.
- **Friends + presence:** Friendship rows are directional `Friendship` records (`PENDING` / `ACCEPTED`) between two `User` rows (see schema above). `GET /friends` returns accepted friends plus incoming/outgoing requests; `POST /friends/request`, `POST /friends/:id/accept`, `POST /friends/:id/reject`, `POST /friends/:id/cancel`, and `POST /friends/:id/remove` power the REST flow. Redis keeps `presence` hash entries per user (`online`, `in-game:{gameSessionId}`), and the WebSocket gateway periodically emits `friendsPresenceUpdated` to each user's personal room. The friends page uses this to render live Online/Offline/In-Game indicators, disables new invites unless a friend is online, and supports Remove Friend / Cancel Request actions.
- **Private room cleanup:** Cancelling a private room deletes both `user_room:{userId}` and `private_room:{code}`. Joining a private room uses Redis WATCH + MULTI/EXEC around `private_room:{code}` so a stale code is rejected if the host cancels during the join race. Disconnect and in-game transitions aggressively clear user queue state, hosted rooms, outgoing invites, and incoming invites.

## 5. Upgrading This Spec

Whenever a new major feature is completed, summarize it and add it to Section 4
(and the schema in Section 3 if it touches the DB) so future AI sessions have
full, current context. Don't let this file go stale — if you notice it's
already stale while working, fix it in the same session rather than leaving it.
