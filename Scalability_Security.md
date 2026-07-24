# EL-LA3EBA: Scalability & Security Invariants

> **Check this file before changing anything in matchmaking, game-session
> state, or the WebSocket gateway.** This is the primary learning goal of the
> project (real-time systems + scale), and the primary risk area (cheating,
> desync, freezes). Treat every rule below as a hard constraint, not a
> nice-to-have — if a change would violate one of these to hit a deadline,
> flag it explicitly instead of shipping it silently.

## 1. Target & Why This Doc Exists

- **Target:** correctly support at least **1000 concurrent users**, most of
  whom are actively in matches (not just browsing the lobby).
- This is the developer's first real project involving WebSockets and
  designing for scale — the goal isn't just "make it work," it's "make it
  work in a way that's actually defensible under load," so favor patterns
  that are provably correct under concurrency over ones that merely pass a
  quick manual test with two browser tabs.
- The existing codebase was **not originally designed** with 1000 concurrent
  users in mind. When you touch old matchmaking/session/gateway code, treat
  it as a candidate for revision against the rules below, not as
  automatically correct just because it's there — but don't rewrite things
  wholesale without cause. Cross-check with `MASTER_SPEC.md` Section 4 first:
  a lot of the atomicity/cleanup work described there was already built with
  these concerns in mind.

## 2. Session Isolation (non-negotiable)

- Every game session's state must be fully namespaced by `gameSessionId` in
  Redis. Two concurrent matches must never be able to read or write each
  other's turn state, scores, strikes, or timers, under any interleaving of
  requests.
- When multiple players queue at the same moment, the matchmaking claim step
  (Lua script / MULTI-EXEC, as already used — see `MASTER_SPEC.md`) must
  guarantee each queued user is claimed into **at most one** match. Two
  matches silently forming from overlapping claims on the same users is a
  correctness failure, not an edge case to shrug off.
- A game mode finishing (or crashing) must not leave state that a _different_
  session can accidentally read — e.g. stale keys, leaked timer references,
  or shared in-memory maps keyed loosely enough to collide.

## 3. Redis Usage Checklist

- Any read-modify-write against shared state (queues, room codes, active-game
  mappings, game state) must be wrapped in `WATCH`/`MULTI`/`EXEC` or a Lua
  script — never a plain GET-then-SET.
- Prefer Lua scripts for anything that needs to be atomic across multiple
  keys (as matchmaking's claim step already does) over multiple round-trips
  wrapped in a transaction, when correctness depends on no other client
  seeing an intermediate state.
- Every ephemeral key (queue entries, private rooms, active-game mappings)
  needs an explicit TTL or an explicit cleanup path (or both) — don't rely on
  "it'll get overwritten eventually." Audit new keys against this before
  merging.
- Cache invalidation must be explicit: if a value is cached (leaderboard,
  presence, penalty payloads), know exactly what event invalidates or
  refreshes it, and confirm that path actually fires in all the ways the
  match can end (normal win, forfeit, disconnect-timeout, server restart).

## 4. WebSocket / Gateway Correctness

- All socket connections from the frontend must go through the existing
  Zustand singleton pattern — no component may open its own raw socket
  connection, ever (this is already a hard rule in `MASTER_SPEC.md`).
- Every socket listener registered for a game session must be torn down on
  disconnect, unmount, or match completion. Leaked listeners are a direct
  path to memory growth and duplicate-event bugs under load.
- Reconnection handling (grace windows, active-game Redis mapping as the
  source of truth over raw Socket.io room membership) must be preserved as
  new game modes are added — don't let a new mode bypass the existing
  disconnect/reconnect machinery by accident.
- New game modes must not introduce their own bespoke timer/reconnect logic
  that diverges from the pattern already established for Strikes, unless
  there's a specific reason the shared pattern doesn't fit — and if so, that
  divergence should be documented here.
- As party sizes grow beyond 1v1 (FFA, 2v2), re-verify that per-session state
  and disconnect handling still isolate correctly per player, not just per
  match — a disconnect from one player in a 4-player FFA must not corrupt or
  pause state for the other three incorrectly.

## 5. Anti-Cheat / Anti-Exploit

Explicitly in scope — these are not hypothetical:

- **No MMR/result manipulation.** Match outcomes and MMR deltas must be
  computed and written server-side only, from server-authoritative game
  state. The client should never be able to submit "I won" or a score value
  directly.
- **No freeze/desync exploits.** A client disconnecting, sending malformed
  input, or spamming events must not be able to stall the other player's
  timer, freeze the round, or desync the two clients' views of game state.
- **No double-join races.** Two browser tabs, or two rapid queue-joins from
  the same user, must not result in a user being placed into two sessions at
  once, or in a session with a phantom/duplicate seat.
- **Turn/timer authority stays server-side.** The 10-second turn timer (and
  any future mode's timers) must be enforced by the server via
  `NodeJS.Timeout`/equivalent, never trusted from client-reported elapsed
  time.
- **Rate limiting stays in place and gets extended.** The existing guess rate limit (5 guesses/1s/user) is a pattern to replicate for any new per-turn input in future game modes (e.g. numeric guesses in "Guess the Number").
- **Fuzzy Match Candidate Hijacking Prevention.** Server-side guess resolution enforces strict candidate locking to `matchedPlayers[0]`. The server will never iterate or auto-select lower-ranked candidate players to satisfy question criteria or bypass already-guessed restrictions, eliminating client-input hijacking exploits.

- When adding a new game mode, write down (even briefly, in this file) what
  its specific cheat surface looks like before shipping it — e.g. for
  "Guess the Number," what stops a client from submitting a guess after
  seeing an opponent's guess.

## 6. Upgrading This Spec

If you find or fix a real exploit, or add a new class of shared state, record
it here — the anti-cheat and Redis-usage sections especially should grow as a
running list of "things that were already checked," not stay static.
