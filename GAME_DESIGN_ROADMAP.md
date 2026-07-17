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

## 2. Deployment Targets (per layer)

- **Frontend:** Next.js (App Router) → Vercel
- **Backend:** NestJS (REST + WebSockets) → Render / Railway / AWS
- **Database:** PostgreSQL (Prisma) → Supabase, using `pg_trgm`, `fuzzystrmatch`, `unaccent`, eventually `pgvector`
- **Cache / live state:** Redis → Upstash (matchmaking queues, live game-state locking via `WATCH`/`MULTI`, turn timers, presence)
- **AI microservice (future):** Python (FastAPI) + LangChain + LLMs (Gemini/OpenAI), for question generation and/or answer refereeing → Vercel/Render

None of this is deployed yet — deployment is a distinct future phase (Section 5).

## 3. Near-Term Improvements (same game mode, more depth)

1. **Per-question answer sets.** Right now questions share the same loosely-correct answer pool. Move to answers scoped specifically to each question.
2. **Very-large-answer-space questions** (e.g. "name a player who's played in the Premier League" — tens of thousands of valid answers). Long-term idea: an AI-assisted check (e.g. against Transfermarkt data) to validate whether a typed name actually satisfies the question, instead of requiring every valid answer to be pre-seeded. This is explicitly a _far-future_ idea, not near-term — don't scope work toward it until the smaller answer-set work above is solid.
3. **Profile/security hardening:**
   - Require re-entering the current password before allowing a password change.
   - Send an email confirmation on register.
   - Send an email confirmation when the account email is changed.
4. **Ranked matchmaking — expanding MMR search range.** Ranked queue only (not unrated). Start narrow (±50 MMR) and widen over time if no match is found — e.g. every 5 seconds, widen the window further (±150, then ±250, growing by roughly +100 per tick) until a match is found. This sits on top of the existing ZSET-based queue described in `MASTER_SPEC.md` — it changes _who_ gets claimed, not the underlying queue/claim mechanism.
5. **Visual identity.** Currently a plain dark theme. Wants an actual football-game visual identity (not just a palette), plus a real logo used in the browser tab and navbar. Theme color scheme itself is considered easy to change later and isn't the current bottleneck — structure/identity is.

## 4. Game Modes — Future

The long-term vision is multiple selectable game modes, not just Strikes. Ideas so far:

- **Strikes (current mode) as FFA.** Extend the existing 1v1 Strikes mode to support 3–4 player free-for-all, not just head-to-head.
- **"Guess the Number" mode.** Host asks a numeric question (e.g. "how many goals has Ronaldo scored for club X"). Players submit a number; closest guess wins the point, exact match wins 2 points. Designed to work both as 1v1 and as free-for-all (3–4 players).
- **2v2 co-op mode.** Team-based play with its own question logic, plus in-game chat: a team-only channel for teammates and a public/all-players channel, for fun/banter — separate from the core gameplay loop.
- **Phase 3: Match Composition & Content Mixing**
  - **Goal**: Transition from simple random match generation to structured, curated gameplay experiences.
  - **Features**:
    - Mix National (Egyptian) and International questions in a defined ratio per match (e.g., 3 National, 7 International per game).
    - Enforce varying difficulty curves or game modes sequentially.
    - Require the newly added `QuestionScope` field on Questions to drive the mixing logic.
- **Survival Mode (sudden death)** and **Daily Challenges** — carried over as open ideas, not yet designed in detail.

**Schema implication:** questions need a `game_mode` column (or similar) so a single question bank can be shared/reused across modes where appropriate, rather than duplicating question data per mode. This is a deliberate schema change, not an afterthought — plan it before building the second game mode, not after.

## 5. Competitive & Meta Systems — Future

1. Elo/MMR point exchange scaled by the rating gap between opponents (bigger gap = bigger MMR swing) — applies to ranked matches only.
2. Global leaderboard UI: top players overall, and filtered to friends.

## 6. UI/UX & Architecture Polish — Future

1. Real football-game visual identity + logo (browser tab, navbar) — see Section 3.4.
2. Smoother animations/transitions for round transitions, strikes, score changes.
3. Ongoing backend modularization as new modes are added, so game-mode logic, socket emission, and DB access stay cleanly separated per mode (see `SCALABILITY_SECURITY.md` for the isolation rules this must satisfy).

## 7. Production Deployment — Future

1. Migrate local Postgres to Supabase; enable `pgvector` if the semantic/AI answer-matching work happens.
2. Deploy Next.js frontend to Vercel with production API env vars.
3. Deploy NestJS + Redis to a cloud provider (Render/Railway/AWS), with correct WebSocket load balancing / sticky sessions for the gateway.
4. Deploy the AI microservice, if/when built.

## 8. Upgrading This Spec

When a roadmap item ships, move its description out of here and into
`MASTER_SPEC.md` Section 4 (and Section 3 if it's a schema change), rather
than marking it "done" in place — this file should only ever describe things
that are _not yet_ built.
