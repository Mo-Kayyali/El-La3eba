# EL-LA3EBA: Game Design & Roadmap

> This is the "what to build next, and why" doc. For what's already built and
> working, see `MASTER_SPEC.md` — don't duplicate "current state" info here,
> update that file instead. For scalability/security rules that apply while
> building any of this, see `SCALABILITY_SECURITY.md`.

## 1. Game Concept

"El-La3eba" (The Players) is a real-time multiplayer football quiz game.
Players compete to answer football trivia questions under time pressure.

- **Core Loop:** Turn-based answering. Players type names. Fuzzy search matches guesses against a player database.
- **Match Format:** "Best of 3" rounds. Players alternate starting turns per round.
- **Loss Condition (per round):** A player loses the round if they accumulate 3 strikes (wrong answers, already-taken players, or timeouts).
- **Turn Timer:** Strict 10-second timer per turn.
- **Current mode:** Strikes (above), playable as Ranked Matchmaking (1v1), Unrated, or Play vs Friend (private room code) — all three currently run the same game-mode logic.
- **Future variant:** Same-device / pass-and-play — one device physically passed between local players, cycling local turns instead of using WebSocket matchmaking. Should support the same configurability as online custom games (mode selection, FFA/2v2, number of questions, timer settings), not a stripped-down version.

## 2. Deployment Targets (per layer)

- **Frontend:** Next.js (App Router) → Vercel
- **Backend:** NestJS (REST + WebSockets) → Render / Railway / AWS
- **Database:** PostgreSQL (Prisma) → Supabase, using `pg_trgm`, `fuzzystrmatch`, `unaccent`, eventually `pgvector`
- **Cache / live state:** Redis → Upstash (matchmaking queues, live game-state locking via `WATCH`/`MULTI`, turn timers, presence)
- **Media storage (future):** Needed once Photo Guess / Career Path Reveal are built (team photos, club badges). Cloudinary free tier (25 credits/mo, pooling storage+bandwidth+transformations) is enough to start; Cloudflare R2 (free egress) is the likely better long-term fit given bandwidth scales with concurrent users. Not yet decided — revisit before building either of those two modes. See Section 7.
- **AI microservice (future):** Python (FastAPI) + LangChain + LLMs (Gemini/OpenAI), for question generation and/or answer refereeing → Vercel/Render

None of this is deployed yet — deployment is a distinct future phase (Section 9).

## 3. Near-Term Improvements (same game mode, more depth)

1. **Per-question answer sets.** Right now questions share the same loosely-correct answer pool. Move to answers scoped specifically to each question.
2. **Very-large-answer-space questions** (e.g. "name a player who's played in the Premier League" — tens of thousands of valid answers). Long-term idea: an AI-assisted check (e.g. against Transfermarkt data) to validate whether a typed name actually satisfies the question, instead of requiring every valid answer to be pre-seeded. This is explicitly a _far-future_ idea, not near-term — don't scope work toward it until the smaller answer-set work above is solid.
3. **Profile/security hardening:**
   - Require re-entering the current password before allowing a password change.
   - Send an email confirmation on register.
   - Send an email confirmation when the account email is changed.
4. **Ranked matchmaking — expanding MMR search range.** Ranked queues only (not unrated). Start narrow (±50 MMR) and widen over time if no match is found — e.g. every 5 seconds, widen the window further (±150, then ±250, growing by roughly +100 per tick) until a match is found. This sits on top of the existing ZSET-based queue described in `MASTER_SPEC.md` — it changes _who_ gets claimed, not the underlying queue/claim mechanism. Applies to both Ranked 1v1 and (once built) Ranked 2v2.
5. **Visual identity.** Currently a plain dark theme. Wants an actual football-game visual identity (not just a palette), plus a real logo used in the browser tab and navbar. Theme color scheme itself is considered easy to change later and isn't the current bottleneck — structure/identity is.

## 4. Lobby, Parties & Custom Rooms — Future

None of this is built yet. This is purely lobby/pre-match layer — it doesn't change core game-session logic itself, but the party/team-size concepts here are exactly what motivate the game-mode strategy refactor (Section 6 of `SCALABILITY_SECURITY.md`; see also GAME_DESIGN_ROADMAP.md Section 6 below).

- **Party system:** A persistent pre-game waiting room, joined via party code, invite link, or directly from the Friends tab. Host decides what happens next from inside the party: queue 1v1, queue 2v2 (with a party friend as teammate, vs random duo or random solo-fills), or launch/queue FFA (3–4 players, from the party and/or filled with randoms). Party members can chat/wait together instead of each managing separate room codes.
- **Custom Rooms:** Browsable in-app (like a server list) — visible to all users. Optional password protection (room stays visible in the browse list even when password-protected; join requires the password, but discovery doesn't leak it). Can also be joined via party launch, direct link, or room code. Host-configurable: game mode, number of rounds, time-to-answer per question, question scope (National/International/mixed ratio), and difficulty (see below).
- **Question difficulty:** New concept — Easy / Medium / Hard, selectable per custom room. Needs a `difficulty` field on `Question` (or similar) once built — not yet in schema.
- **Team configuration variants to support** (all really just "who's in the party" + "how are teams assigned" on top of one matchmaking pipeline, not separate systems):
  - Same room, same device (couch play / pass-and-play) — see Section 1.
  - 2v2 with a friend as teammate vs. random opponents.
  - 2v2 all-friends (party of 4, teams assigned manually or randomized in the lobby).
  - 2v2 with a random teammate (solo-queue into 2v2, paired with a random partner).

## 5. Ranked, MMR & Seasons — Future

- **MMR scope (decided):** Only **Ranked 1v1** and **Ranked 2v2** affect MMR. No per-mode MMR, no global/averaged MMR across modes — kept deliberately simple. Unrated and Custom Rooms never touch any rating, regardless of mode.
- **Ranked 2v2:** confirmed to be built, but intentionally scheduled toward the end of the new-modes build-out (see Section 6 priority notes) — keep it in mind architecturally (team-based MMR, duo-queue) while doing earlier work, but it isn't next.
- **Ranked FFA — not being built now, but documented as a future concept:** 4 players compete, ranked by placement (1st–4th). 1st and 2nd gain MMR, 3rd and 4th lose MMR, with 4th losing more than 3rd. MMR delta still scaled by opponents' MMR, similar in spirit to 1v1 Elo but adapted for 4-way placement — this needs its own small design pass when it's actually scheduled, not just an implementation prompt.
- **Seasons:** Soft-reset/compress MMR periodically (e.g. compress toward a baseline like 1200 at season start) to keep ranked play fresh long-term.
- **Global leaderboard UI:** top players overall, and filtered to friends (unchanged from earlier planning).

## 6. Game Modes — Future

The long-term vision is multiple selectable game modes, not just Strikes. **None of these need to ship together or before "v1" — this is a backlog to pull from, not a launch checklist.**

**Schema note:** `Question.gameMode` (enum `GameMode`) already exists and already reserves `TOP_10`, `PHOTO_GUESS`, and `LINEUP` as placeholder values alongside `STRIKES` (see `MASTER_SPEC.md` Section 3) — so the "questions need a game_mode column" concern from earlier planning is already resolved at the schema level. However, **none of TOP_10, PHOTO_GUESS, or LINEUP have any backend or frontend logic built yet** — they exist only as enum placeholders. Treat them as fully unbuilt modes.

**Suggested build order** (cheapest/most schema-ready first; not a commitment, just current thinking): Shared Clubs → Top 10 → Lineup → Career Path Reveal → Photo Guess → Player Story → Connections → Strikes FFA / 2v2 infra work → Draft Mode → Pure Trivia → Ranked 2v2. The **game-mode strategy refactor must happen before the first of these is built** — see `SCALABILITY_SECURITY.md` Section 4 and the pending refactor discussion.

### Near-schema / cheap to build

- **Shared Clubs.** "Name a player who's played for both Club X and Club Y." Mechanically an AND of two CLUB `QuestionFilterClause` rows — fits the existing FILTER/AND system with **zero schema changes**.
- **Top 10.** E.g. "Top 10 all-time goal scorers for Real Madrid." ~5 minute match, ~10–15s per guess window. Players race to name the top 10. Guessing the correct 11th-ranked player costs **-1 point**, 12th costs **-2 points**, 13th costs **-3 points**; anything ranked below 13th costs nothing (no penalty for wild guesses further out — keeps it fun rather than punishing). Round ends when all 10 are found or time runs out. Uses `QuestionAnswer.rank`, which already exists in schema.
- **Lineup.** E.g. "Name the starting XI for Man City vs Real Madrid, UCL SF first leg, 2023." Plays like Strikes — 3 strikes = out, but the eliminated player must wait for the opponent to also finish/strike out rather than the round ending immediately. +1 point per correct player, ~10–15s timer per guess. Uses `QuestionAnswer.slotLabel`, which already exists in schema.

### Needs new asset/data population, no schema changes (or minimal)

- **Career Path Reveal.** A player's club history reveals one badge at a time, ~5s apart. Question states upfront whether the target is retired or current. Each player gets 2 guesses total, usable any time; once both are used they're out for the round. Scoring: correct guess before all clubs revealed = 2 points; after full reveal there's a 20s final window, correct guess there = 2 points; if both players run out of guesses or time expires with no correct answer, round ends with no points. Needs real club badge images populated into the existing `Club.logoUrl` field — no schema change, but real asset-sourcing work.

### Needs schema additions

- **Photo Guess.** Uses an actual pre-match starting-XI team photo (requires image upload at question-creation time). Players take turns guessing who's who in the photo; 3 strikes, ~10–15s timer, +1 point per correct guess, round ends when everyone in the photo is identified. Needs a new photo-upload field on `Question` (current `photoPlayerId` only supports a single target player, not a team photo with multiple tagged players) plus a hosting decision (Section 7).
- **Player Story.** A player is described through narrative hints, revealed over time: hint 1 (hardest, revealed first) = 3 points if guessed; ~20s later hint 2 reveals = 2 points; ~20s later hint 3 reveals = 1 point; final ~20s window after hint 3, then skip if unguessed. 2 guesses per player, usable any time — fastest correct guess wins (simultaneous guessing, not turn-based). Needs 3 new hint-text fields on `Question` (or a related table).
- **Pure Trivia.** Classic single-answer trivia (e.g. "Who scored the fastest Premier League hat-trick?", "What's Real Madrid's home stadium?"). Answer can be a **player OR plain text** — this is new, since answers are currently always tied to `QuestionAnswer.playerId`. Usually 1 correct answer, occasionally 2 if tied. ~30s timer, simultaneous guessing, 2 guesses per player, fastest correct wins. Needs its own fuzzy text-matching approach (separate from the existing player-fuzzy-search) and likely a new `AnswerType` (e.g. `TEXT`) or a generalized answer model. **This is the most architecturally disruptive mode on this list** — it's the first one where an answer isn't necessarily a `Player` row — and should get its own investigate-first design discussion before a build prompt is written, not be scoped inline with an implementation prompt.

### Needs new source data (heavy content-authoring cost — save for later)

- **Draft Mode.** Show 10 players (names + photos) and 10 categories (e.g. "most career goals," "most appearances," "retired earliest," "most World Cup caps"); players compete to correctly match players to categories. Requires actual counting-stat data (goals, appearances, caps, etc.) that isn't modeled anywhere in `Player`/`PlayerClub` today. Data would need to be manually researched and seeded per question at creation time — high authoring cost per question, not derived automatically. Intentionally scheduled for later.

### Connections (two variants)

- **Player Connections** — given two players, find/name their shared club.
- **Club Connections** — given two clubs, find/name a shared player between them.
- Both are close cousins of Shared Clubs, but the answer is pre-resolved and seeded directly into the question at creation time (rather than validated live via filter logic) — simple to build once the data is right at seed time.

### FFA / 2v2 / other carried-over ideas

- **Strikes FFA.** Extend the existing 1v1 Strikes mode to 3–4 player free-for-all.
- **Guess the Number.** Host asks a numeric question (e.g. "how many goals has Ronaldo scored for club X"). Players submit a number; closest guess wins the point, exact match wins 2 points. Works both 1v1 and FFA (3–4 players).
- **2v2 co-op mode.** Team-based play with its own question logic, plus in-game chat: a team-only channel for teammates and a public/all-players channel for banter, separate from the core gameplay loop.
- **Phase 3: Match Composition & Content Mixing.** Mix National (Egyptian) and International questions in a defined ratio per match (e.g. 3 National, 7 International); enforce varying difficulty curves or game modes sequentially. Uses the existing `QuestionScope` field.
- **Survival Mode (sudden death)** — carried over as an open idea, not yet designed in detail.
- **Daily Challenge (decided):** Wordle-style single-player daily mode — one mystery player per day, guesses return attribute-proximity feedback (nationality, position, club, age, etc.), similar to football Wordle/Poeltl-style games. Asynchronous, resets daily, entirely separate from the competitive/MMR track.

## 7. Media/Asset Hosting — Future

- Needed for **Photo Guess** (team photo upload) and **Career Path Reveal** (club badges — `Club.logoUrl` already exists as a field, just needs population).
- **Not yet decided.** Cloudinary's free tier (25 credits/month, pooling storage + bandwidth + transformations into one budget) is enough to get started, but bandwidth draws from the same pool as storage, which could bite at the 1000-concurrent-user target — free/fixed Cloudinary tiers also suspend uploads on overage rather than billing gracefully. Cloudflare R2 (free egress, S3-compatible) is the likely better long-term fit given bandwidth is the part that scales with concurrent users, but hasn't been set up. GitHub Student Pack may also have a relevant partner storage/CDN offer — worth checking directly since these rotate. Revisit this decision specifically before starting Photo Guess or Career Path Reveal implementation, not before.

## 8. UI/UX & Architecture Polish — Future

1. Real football-game visual identity + logo (browser tab, navbar) — see Section 3.5.
2. Smoother animations/transitions for round transitions, strikes, score changes.
3. Ongoing backend modularization as new modes are added, so game-mode logic, socket emission, and DB access stay cleanly separated per mode (see `SCALABILITY_SECURITY.md` for the isolation rules this must satisfy). **This is the game-mode strategy refactor** referenced throughout Section 6 above — needs a real design discussion before any new-mode build prompt is written.

## 9. Production Deployment — Future

1. Migrate local Postgres to Supabase; enable `pgvector` if the semantic/AI answer-matching work happens.
2. Deploy Next.js frontend to Vercel with production API env vars.
3. Deploy NestJS + Redis to a cloud provider (Render/Railway/AWS), with correct WebSocket load balancing / sticky sessions for the gateway.
4. Set up media storage (Section 7) before Photo Guess / Career Path Reveal go live in production.
5. Deploy the AI microservice, if/when built.

## 10. Upgrading This Spec

When a roadmap item ships, move its description out of here and into
`MASTER_SPEC.md` Section 4 (and Section 3 if it's a schema change), rather
than marking it "done" in place — this file should only ever describe things
that are _not yet_ built.
