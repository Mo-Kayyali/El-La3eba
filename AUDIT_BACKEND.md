# EL-LA3EBA: Full Backend Audit Report

> **Audit date:** 2026-07-15
> **Scope:** Backend-only. Read-only pass — no code was changed.
> **Files read:** All NestJS source files under `backend/src/`, `backend/prisma/schema.prisma`, plus all three spec docs.
> **Reference docs:** `MASTER_SPEC.md` (ground truth), `SCALABILITY_SECURITY.md` (hard constraints), `GAME_DESIGN_ROADMAP.md` (future work only — not audited as current).

---

## My Understanding of the Current Architecture

Before findings: a brief summary of what I believe the system is and what this audit may and may not touch.

**What exists:** A NestJS monolith with six modules (`auth`, `users`, `game`, `friends`, `redis`, `prisma`). The `game` module contains the WebSocket gateway, matchmaking, leaderboard, and ELO utilities. PostgreSQL (via Prisma) is the durable store; Redis (ioredis, Upstash-targeted) is the ephemeral store for queues, game state, presence, and caches. The frontend is Next.js and connects via Socket.io — the backend has no knowledge of frontend internals. This audit covers backend only.

**What this audit must not touch:** Frontend code, deployment configuration, or future roadmap items.

---

## 1. Auth Module

### Matches the Docs

- `POST /auth/register` and `POST /auth/login` exist and work as documented.
- `GET /auth/me` returns `activeGameSessionId` (with legacy `active_game:{userId}` fallback), `pendingIncomingFriendRequests`, and `pendingOfflinePenalty` exactly as MASTER_SPEC.md Section 4 describes.
- `POST /auth/acknowledge-offline-penalty` clears the Postgres record and deletes the Redis `penalty:{userId}` key.
- JWT strategy (`jwt.strategy.ts`) does a live DB lookup on every authenticated request to validate the user still exists — this is correct and safe.
- `bcrypt` is used for password hashing with `genSalt()`.
- `rememberMe` option is wired: `1d` vs `30d` expiry.
- JWT secret falls back to `'super-secret-jwt-key'` — both `auth.module.ts` and `jwt.strategy.ts` use the same fallback string consistently.

### Drifted from the Docs

| Item | MASTER_SPEC.md says | Code does | Which is right |
|------|---------------------|-----------|----------------|
| Password change flow | GAME_DESIGN_ROADMAP Section 3 notes it as planned: "Require re-entering current password before allowing a password change." | `PATCH /users/profile` accepts a new `password` field with **no current-password check** | Roadmap correctly flags this as a gap; the code is incomplete here. |
| `Friendship` field names | MASTER_SPEC Section 3: `requesterId` / `addresseeId` | Actual schema: `userId` / `friendId` | Code is the real implementation; MASTER_SPEC Section 3 field names are wrong/stale. |
| `OfflinePenalty.acknowledged` (boolean) | MASTER_SPEC Section 3 says boolean | Schema has `acknowledgedAt DateTime?` (nullable timestamp) | Code is correct; spec is stale. |

### Bugs / Risks

- **[auth.service.ts, lines 155-167]** The legacy `active_game:{userId}` migration path in `getProfileById` writes the migrated key via `MULTI/EXEC`, but the `MULTI` is not preceded by a `WATCH`. This is a plain GET-then-SET pattern for the migration step — violates the atomicity rule in SCALABILITY_SECURITY.md Section 3.

- **[auth.service.ts, lines 215-229]** `requestVerification` stores a 6-digit code in Redis (`verify_email:{userId}`) with no rate limit on the endpoint. A user can spam `POST /auth/request-verification` indefinitely — no cooldown, no brute-force protection.

- **[auth.service.ts, lines 232-253]** `verifyEmail` does a plain `GET` then comparison then `DEL` — three separate Redis operations with no atomicity guarantee. Two concurrent verify calls could both read the code before either deletes it. Violates SCALABILITY_SECURITY.md Section 3 (read-modify-write must use WATCH/MULTI or Lua).

- **[jwt.strategy.ts line 12, auth.module.ts line 12]** Fallback secret `'super-secret-jwt-key'` is hardcoded in both files. If `JWT_SECRET` is not set in production, all tokens are signed with a publicly known default. Production deployment risk.

---

## 2. Matchmaking Service

### Matches the Docs

- Both `ranked_queue` / `ranked_queue_members` and `unrated_queue` / `unrated_queue_members` ZSETs exist as documented.
- Per-user metadata key `queue_search:{userId}` is created with explicit 60s TTL.
- The Lua script (`popValidPlayerPair`) atomically claims two oldest entries, self-heals orphaned ZSET entries, and removes claimed users from both ZSET and members set. This is the correct atomic claim approach.
- `purgeExpiredUsers` runs `ZRANGEBYSCORE`, emits `searchExpired`, then removes with `ZREMRANGEBYSCORE` + `SREM` + `DEL` in a `MULTI` block (purge-before-match on each tick).
- Private rooms use `private_room:{code}` + `user_room:{userId}` with explicit 60s TTL.
- `joinPrivateRoom` uses `WATCH` on `private_room:{code}` + `MULTI/EXEC` to atomically consume the room.
- `initializeGameState` sets `user_active_game:{userId}` for both players inside a `MULTI` block atomically with the game state write.
- 2-second matchmaking tick (`@Interval(2000)`) processes both queues in parallel.
- `playerMmr` is embedded in the initial game state as documented.

### Drifted from the Docs

None material. Minor: `searchExpired` is emitted before `ZREMRANGEBYSCORE` (a tiny benign window), which is slightly different from the strict description but functionally correct.

### Bugs / Risks

- **[matchmaking.service.ts, lines 116-139] `joinQueue` is non-atomic — double-join race.** The remove-then-add sequence uses separate `zrem`/`srem`/`zadd`/`sadd`/`set` calls with no MULTI wrapper. Two concurrent `joinQueue` calls from the same user (two browser tabs) can interleave and result in duplicate or conflicting entries. The Lua claim script mitigates the downstream claim step, but a user could end up with two `queue_search:{userId}` keys with different socket IDs if both calls race through lines 121-139 concurrently. This is the "double-join race" explicitly called out in SCALABILITY_SECURITY.md Section 5.

- **[matchmaking.service.ts, lines 541-548] `setActiveGameSessionIdForUser` has no TTL.** The `user_active_game:{userId}` key is a plain `SET` with no `EX`. If the server crashes mid-game, this key becomes a permanent orphan, giving the user a permanent active-game lock. The self-healing logic in `getActiveGameSessionIdForUser` eventually cleans it up, but only when the user reconnects. A safety-net TTL (e.g., 6 hours) would prevent indefinite locks.

- **[matchmaking.service.ts, lines 66-91] Double cleanup path for private rooms.** Private rooms have both a Redis TTL (60s) AND a server-side `setTimeout` (60s) via `roomExpiryTimers`. The `setTimeout` callback (lines 74-85) reads `user_room:{userId}` then does a MULTI/DEL without WATCH between them. The `clearRoomExpiryTimer` call in `cleanupUserPrivateRoom` does prevent stale fires, but the dual mechanism adds complexity for no functional gain — the Redis TTL alone handles expiry; the `setTimeout` only serves to emit `roomExpired` over the socket.

---

## 3. Game Gateway / WebSocket Handling

### Matches the Docs

- 30-second disconnect grace window: `DISCONNECT_GRACE_MS = 30_000` (line 64).
- Disconnect timer key is `${gameSessionId}:${userId}` — correctly scoped per player per session.
- `handleDisconnect` uses `getActiveGameSessionIdForUser(userId)` (Redis lookup) not Socket.io room membership.
- Grace timer fires, reads game state with `WATCH`, checks `status === 'match_completed'` before forfeiting, uses `MULTI/EXEC`, aborts on `results === null`.
- `joinGameRoom` fetches Redis state first, rejects reconnect if `status === 'match_completed'`.
- `joinGameRoom` clears disconnect timer and emits `playerReconnected` + restarts turn timer.
- Turn timer (`startTurnTimer`) is server-side `setTimeout(10_000)`. Client elapsed time never consulted.
- Guess processing (`handleSubmitGuess`) uses `WATCH` + `MULTI/EXEC`.
- Forfeit (`handleForfeitMatch`) uses `WATCH` + `MULTI/EXEC`.
- Rate limiter: sliding window, 5 guesses / 1s per user, in-process Map.
- `matchOver` always includes explicit `forfeit: boolean`.
- `leaveEndedMatch` deletes both `user_active_game:{userId}` and `active_game:{userId}` (legacy).
- Active-game mappings deleted on normal completion, forfeit, and disconnect-forfeit via `deleteActiveGameKeysInMulti`.
- Presence hash managed correctly on connect, join, and disconnect.
- `forfeitMatch` does NOT write an offline penalty (correct — manual forfeit, not disconnect-forfeit).

### Drifted from the Docs

| Item | MASTER_SPEC.md says | Code does | Which is right |
|------|---------------------|-----------|----------------|
| CORS | Not documented | Gateway: `origin: '*'`. `main.ts`: `origin: ['http://localhost:3001']`. Two different CORS configs. | Neither is documented. Gateway `origin: '*'` is a security concern. |

### Bugs / Risks

- **[game.gateway.ts, line 112] `scheduleInviteExpiry` logic is inverted.** The condition is:
  ```typescript
  const exists = await this.redisClient.exists(inviteKey).catch(() => 0);
  if (exists) return;
  ```
  This returns early when the invite key STILL EXISTS (not yet expired), and only proceeds to cancel when the key is already gone. The intent (from the surrounding code) was `if (!exists) return` — do nothing if the invite was already handled. The code works accidentally because the `setTimeout` fires at 60,250ms while the Redis TTL is 60s, so the key has usually already expired by then. But if there is any timer drift or Redis slowness, the callback does nothing when it should act. **Latent logic bug — one character fix (`!exists`).**
  > `game.gateway.ts`, line 112

- **[game.gateway.ts, lines 136-138 and 174-175] `KEYS` pattern scans on hot paths.** Both `cancelActiveInvitesByInviter` and `cancelPendingInvitesForInvitee` call `this.redisClient.keys('game_invite:inviterId:*')` and `this.redisClient.keys('game_invite:*:inviteeId')` respectively. Redis `KEYS` is O(N) over the entire keyspace and blocks the Redis event loop. These are called on every disconnect and on every `joinQueue` / `joinGameRoom`. At 1000 concurrent users this will cause severe Redis latency spikes.

- **[game.gateway.ts, line 33]** WebSocket gateway uses `{ cors: { origin: '*' } }`. The REST server (main.ts) restricts to `['http://localhost:3001']`. The gateway allows connections from any origin, bypassing the REST CORS restriction.

- **[game.gateway.ts, lines 1162-1163] Rematch old-room socket leak.** After both players confirm a rematch:
  ```typescript
  this.server.in(gameSessionId).socketsJoin(newGameSessionId);
  ```
  Sockets are added to the new room but never removed from the old room (`socketsLeave` is not called). Both players remain subscribed to the old `gameSessionId` room indefinitely. Any future event emitted to the old room reaches both players, violating session isolation (SCALABILITY_SECURITY.md Section 2).

- **[game.gateway.ts, lines 599-614] Turn-timer WATCH conflict retry extends turn beyond 10s.** When `multi.exec()` returns null (concurrent modification), `startTurnTimer(gameSessionId)` is called again — restarting the full 10-second timer. Repeated conflicts (e.g., from rapidly concurrent guess submissions) could chain into the turn lasting 20s, 30s, etc. This violates the strict 10-second timer rule.

- **[game.gateway.ts, line 58] `guessTimestamps` Map never pruned on disconnect.** Each user who submits guesses and then disconnects leaves a stale array entry in the Map permanently. This is a slow memory leak at scale — at 1000 concurrent users with frequent disconnects, entries accumulate without bound.

- **[game.gateway.ts, lines 1284-1293]** `setActiveGameSessionIdForUser` inside `joinGameRoom`'s `Promise.allSettled` fails silently. If Redis is down, the active-game key is not set, and reconnection after a server restart won't work. No log is emitted on failure.

---

## 4. Friends System

### Matches the Docs

- REST endpoints match exactly: `POST /friends/request`, `POST /friends/:id/accept`, `POST /friends/:id/reject`, `POST /friends/:id/cancel`, `POST /friends/:id/remove`, `GET /friends`.
- `Friendship` model is directional — both PENDING and ACCEPTED rows come from one table.
- Presence hash `presence` per user — `online`, `in-game:{gameSessionId}`.
- `broadcastFriendPresences` runs every 5 seconds (`@Interval(5000)`).
- `emitFriendRequestReceived` pushes real-time `friendRequestReceived` event to the recipient socket room.
- `ensureUsersAreFriends` check before sending game invite.

### Drifted from the Docs

| Item | MASTER_SPEC.md says | Code does | Which is right |
|------|---------------------|-----------|----------------|
| Schema field names | `requesterId` / `addresseeId` | `userId` / `friendId` | Code is correct; spec is stale. |

### Bugs / Risks

- **[friends.service.ts, lines 261-268 + game.gateway.ts, lines 261-282] Presence broadcast causes DB storm at scale.** On every 5s tick, `broadcastFriendPresences` calls `getFriendPresenceSnapshot(userId)` for every online user in parallel. `getFriendPresenceSnapshot` calls `getFriendsList` which issues 3 separate DB queries (accepted friends, incoming requests, outgoing requests). At 500 online users each with 20 friends: 500 × 3 = 1,500 Postgres queries every 5 seconds, plus 500 × 20 = 10,000 Redis `hget` calls. This will not scale to 1000 concurrent users. The `presence` hash already contains all necessary data — no DB query is needed for the presence broadcast.

- **[friends.service.ts, lines 243-249] N+1 Redis pattern for friend presence.** Inside `getFriendsList`, each accepted friendship triggers a separate `hget('presence', friendId)` call. This is N individual Redis round-trips per friend list. Should be replaced with `hmget` or `hgetall` + filter.

- **[game.gateway.ts, lines 243-253] `presence` hash has no TTL.** Entries are only cleaned up in `handleDisconnect` (line 798). If a server crashes, all online users' presence entries become permanently stale. There is no TTL and no periodic garbage collection. A stale `online` presence for a user who is actually disconnected will mislead friends' presence indicators.

---

## 5. Leaderboard

### Matches the Docs

- Cache key is `global_leaderboard` — matches MASTER_SPEC Section 4 exactly.
- 10-minute cron refresh via `@Cron(CronExpression.EVERY_10_MINUTES)`.
- Cache TTL is 2 hours (7200s) — longer than cron interval, so a cron miss doesn't cause a cache miss.
- On cache miss, `getLeaderboard` falls back to `refreshLeaderboard()` immediately.
- Returns top 10 users ordered by MMR descending.

### Drifted from the Docs

None. The leaderboard is a faithful implementation of what MASTER_SPEC Section 4 describes.

### Bugs / Risks

- **[leaderboard.service.ts, lines 79-84]** On a cache miss, `getLeaderboard` calls `refreshLeaderboard()` (which does a DB query and a Redis SET) then immediately calls `redisClient.get(CACHE_KEY)` again. This is 2 Redis round-trips where 0 are needed — could just return `topUsers` directly from the `refreshLeaderboard` call. Minor inefficiency, not a correctness bug.

- **[leaderboard.service.ts]** No explicit cache invalidation after a ranked match completes. Leaderboard can be stale for up to 10 minutes after MMR changes. This is a documented design decision, but at 1000 users with frequent ranked matches, the leaderboard will frequently show incorrect ordering.

---

## 6. Offline Penalty System

### Matches the Docs

- `OfflinePenalty` Postgres record is written via `prisma.$transaction` (atomically with user stat update).
- Redis `penalty:{userId}` cache is set with 7-day TTL immediately after the transaction commits.
- Ranked disconnect-forfeit: `mmrLost` = actual MMR delta. Unrated: `mmrLost = 0`.
- `GET /auth/me` returns `pendingOfflinePenalty` (hydrated from Redis, falling back to DB).
- `POST /auth/acknowledge-offline-penalty` bulk-updates all unacknowledged penalties and clears Redis.
- `recordOfflinePenalty` also increments `offlineDisconnectCount` and sets `lastDisconnectAt`.

### Drifted from the Docs

| Item | MASTER_SPEC.md says | Code does | Which is right |
|------|---------------------|-----------|----------------|
| `OfflinePenalty.acknowledged` | Spec says boolean field `acknowledged` | Schema has `acknowledgedAt DateTime?` (nullable timestamp, not a boolean field) | Code is correct; spec is stale. |
| Penalty logic location | Spec implies `AuthService` handles it | `recordOfflinePenalty` lives in `UsersService`. `acknowledgeOfflinePenalty` exists in BOTH `AuthService` (lines 180-194) AND `UsersService` (lines 121-137) with identical logic. The auth controller calls `AuthService`. | Duplication — dead code in `UsersService`. |

### Bugs / Risks

- **[auth.service.ts lines 180-194 vs users.service.ts lines 121-137]** `acknowledgeOfflinePenalty` is implemented identically in both services. The `UsersService` version is never called from any controller — it is dead code and a maintenance hazard.

- **[users.service.ts, lines 56-66]** Redis cache write after `prisma.$transaction` is outside the transaction scope. If Redis is down when the transaction commits, the Postgres record exists but the cache is not populated. The DB fallback in `getPendingOfflinePenalty` covers this gracefully, but it means the "exactly once" Redis write is not guaranteed.

- **[game.gateway.ts, line 471-473]** MMR loss computation fallback: `Math.max(0, -(mmrDeltas?.[userId] ?? -15))`. If `updateMmrAfterMatch` returns null due to a DB error (MMR was NOT actually deducted), the penalty records `mmrLost = 15`. The user sees "you lost 15 MMR" in the modal, but their actual MMR was not changed. Cosmetic bug with real UX impact.

---

## 7. Prisma Schema vs MASTER_SPEC.md Section 3

### Schema Comparison Table

| Model / Field | MASTER_SPEC Section 3 says | Actual schema.prisma | Assessment |
|---|---|---|---|
| `User.id` | `uuid (pk)` | `String @id @default(uuid())` | Match |
| `User.email` | `string (unique)` | `String @unique` | Match |
| `User.username` | `string (unique)` | `String @unique` | Match |
| `User.passwordHash` | `string` | `String` | Match |
| `User.mmr` | `int (default 1000)` | `Int @default(1000)` | Match |
| `User.wins` | `int` | `Int @default(0)` | Match |
| `User.gamesPlayed` | `int` | `Int @default(0)` | Match |
| `User.createdAt` | `datetime` | `DateTime @default(now())` | Match |
| `User.isVerified` | **Not documented** | `Boolean @default(false)` | Undocumented field in spec |
| `User.offlineDisconnectCount` | **Not documented** | `Int @default(0)` | Undocumented field in spec |
| `User.lastDisconnectAt` | **Not documented** | `DateTime?` | Undocumented field in spec |
| `User.updatedAt` | **Not documented** | `DateTime @updatedAt` | Undocumented field in spec |
| `User` B-tree index on `mmr` | Documented | `@@index([mmr])` | Match |
| `FootballPlayer.activeYear` | `string` | `Int` (integer) | **Type mismatch** — spec says string, code has Int |
| `FootballPlayer` GIN+trgm indexes | Documented | Not in schema.prisma | Expected — Prisma does not support custom index operators; likely in raw migration SQL. Should verify migration files contain these. |
| `Friendship.requesterId` / `addresseeId` | MASTER_SPEC Section 3 | `userId` / `friendId` in actual schema | Field names don't match spec — code is correct, spec is stale |
| `Friendship.status` | `enum (PENDING \| ACCEPTED)` | `FriendshipStatus` enum | Match |
| `OfflinePenalty.acknowledged` | `boolean` | `acknowledgedAt DateTime?` | Type/name mismatch — spec says boolean, code uses nullable timestamp. Code is correct. |
| `Question` model | Explicitly flagged as missing in Section 3 | **Absent from schema.prisma** | Confirmed gap |

### The Question Model Gap

`game.questions.ts` contains a hardcoded array of 7 question strings. There is **no Question model in the database**. Questions are not stored in Postgres. This means:

- The fuzzy-match search (`guessPlayer` in `game.service.ts`) searches the entire `FootballPlayer` table as the answer space for every question.
- There is no per-question answer scoping. All 7 questions share the same answer pool (the full `FootballPlayer` table).
- Adding per-question answer sets (GAME_DESIGN_ROADMAP near-term item #1) will require a schema migration and significant game logic changes.
- The `currentQuestion` field stored in Redis game state is just a plain string — there is no question ID or structured metadata.

---

## Summary: Scalability Concerns at ~1000 Concurrent Users

| Concern | Severity | Location |
|---|---|---|
| `KEYS` pattern scan on disconnect/join (invite cleanup) | High | `game.gateway.ts` lines 136-138, 174-175 |
| `getFriendPresenceSnapshot` triggers 3 DB queries per online user every 5s | High | `friends.service.ts` lines 261-268, `game.gateway.ts` lines 261-282 |
| `presence` hash has no TTL — stale entries after server crash | Medium | `game.gateway.ts` line 244, 248 |
| `user_active_game:{userId}` has no TTL | Medium | `matchmaking.service.ts` line 541 |
| `guessTimestamps` Map never pruned for disconnected users | Medium | `game.gateway.ts` line 58 |
| In-process rate limiter resets on server restart (stated acceptable in comments) | Medium | `game.gateway.ts` line 25-31 |
| `joinQueue` is non-atomic — double-join race possible from two tabs | Medium | `matchmaking.service.ts` lines 116-139 |
| Turn-timer WATCH conflict retry extends turn beyond 10s | Medium | `game.gateway.ts` lines 611-614 |
| N+1 Redis hget calls in friend list presence resolution | Medium | `friends.service.ts` lines 243-249 |

---

## Summary: Security / Anti-Cheat Gaps vs SCALABILITY_SECURITY.md Section 5

| Checklist Item | Status | Notes |
|---|---|---|
| Match outcomes computed server-side only | Pass | Client submits guess text only; server evaluates all state |
| MMR deltas written server-side only | Pass | `updateMmrAfterMatch` in `matchmakingService` writes to DB |
| Turn timer server-side only | Pass | `setTimeout(10_000)` in gateway; client time never trusted |
| No double-join race for matchmaking | Partial | Lua claim script prevents double-claim; `joinQueue` itself is non-atomic |
| Rate limiting on `submitGuess` | Pass | 5/1s sliding window in-process |
| Server-authoritative game state in Redis | Pass | `game:{gameSessionId}` is the source of truth |
| No freeze/desync via disconnect | Pass | Turn timer keeps running during grace window |
| CORS restricted | Fail | Gateway CORS is `origin: '*'`; should match allow-list |
| Password change requires current password | Fail | Not implemented — live security gap, flagged as roadmap item |
| No brute-force on verification code endpoint | Fail | `request-verification` has no rate limit or cooldown |
| Verification code check is atomic | Fail | Plain GET then compare then DEL — three separate Redis ops |
| Session isolation (no cross-session state) | Partial | Rematch old-room not cleaned up — stale room membership after rematch |

---

## Recommended Priority Order for Fixes

> **Do not fix now.** This is audit-only. Prioritized for the next working session.

1. **P0 — `inviteExpiryTimer` logic inversion** (`game.gateway.ts`, line 112)
   `if (exists) return` should be `if (!exists) return`. Currently the invite expiry callback does the opposite of what was intended. Easy one-character fix, high correctness impact.

2. **P0 — Replace `KEYS` pattern scans with `SCAN` or a secondary index** (`game.gateway.ts`, lines 136, 174)
   `redisClient.keys(pattern)` is O(N) blocking on the entire Redis keyspace. At 1000 users, this will cause Redis latency spikes on every disconnect. Replace with SCAN-based iteration or store invite keys in a per-user Redis Set (e.g., `game_invites_sent:{inviterId}`) for O(1) lookups.

3. **P0 — Friend presence broadcast DB storm** (`friends.service.ts` line 261, `game.gateway.ts` line 261)
   Every 5-second tick fires N parallel DB queries (3 per online user). Refactor: read the `presence` Redis hash directly for the broadcast tick; query DB only for the friend relationship list (which can be cached with a short TTL).

4. **P1 — Fix rematch old-room socket orphan** (`game.gateway.ts`, line 1163)
   After `socketsJoin(newGameSessionId)`, call `this.server.in(gameSessionId).socketsLeave(gameSessionId)`. Otherwise both players remain subscribed to the old completed-game room indefinitely, violating session isolation.

5. **P1 — Add TTL to `user_active_game:{userId}`** (`matchmaking.service.ts`, line 541)
   Add a 4-6 hour safety-net TTL to prevent permanent orphaned active-game locks after server crashes.

6. **P1 — Add rate limit to `POST /auth/request-verification`**
   One verification request per 60s per user. Use the same `SET ... NX EX` cooldown pattern already used for game invites.

7. **P1 — Make verification code check atomic** (`auth.service.ts`, line 232)
   Replace GET → compare → DEL with a Lua script or `GETDEL` (Redis 6.2+) to atomically retrieve and delete the code.

8. **P1 — Restrict WebSocket CORS** (`game.gateway.ts`, line 33)
   Change `{ cors: { origin: '*' } }` to match the REST API's allowed origins.

9. **P1 — Prune `guessTimestamps` Map on disconnect** (`game.gateway.ts`)
   In `handleDisconnect`, delete the user's entry from `guessTimestamps` to prevent memory growth.

10. **P1 — Remove duplicate `acknowledgeOfflinePenalty` in `UsersService`** (`users.service.ts`, lines 121-137)
    Dead code. Either delete it and call `AuthService.acknowledgeOfflinePenalty` everywhere, or move the logic entirely to `UsersService` and remove it from `AuthService`.

11. **P2 — Fix MMR fallback in disconnect-forfeit penalty** (`game.gateway.ts`, line 471)
    If `mmrDeltas` is undefined (DB error during MMR update), record `mmrLost = 0` rather than `15`. The user should not see a penalty for MMR that was never actually deducted.

12. **P2 — Turn-timer WATCH conflict should not reset the full 10s timer**
    On a WATCH conflict during `startTurnTimer`, consider capping the retry delay to a short backoff (e.g., 100ms) rather than restarting the full 10s window.

13. **P2 — Update MASTER_SPEC.md Section 3 to match actual schema**
    Correct: `Friendship.requesterId→userId`, `Friendship.addresseeId→friendId`, `OfflinePenalty.acknowledged→acknowledgedAt DateTime?`, add `User.isVerified`, `User.offlineDisconnectCount`, `User.lastDisconnectAt`, `User.updatedAt`. Fix `FootballPlayer.activeYear` type (Int not string). Document that questions are currently hardcoded strings in `game.questions.ts`, not a DB model.

14. **P2 — Require current password on password change** (`users.service.ts`, `updateOwnProfile`)
    `PATCH /users/profile` should accept and validate `currentPassword` via `bcrypt.compare` before allowing `password` to be changed. This is flagged in the roadmap but is a live security gap now.

---

*Report generated by Antigravity audit pass. No code was modified.*
