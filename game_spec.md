# Project: El La3eba (The Players) - Master Specification

## 1. Game Concept

"El La3eba" is a real-time multiplayer football quiz game. Players compete to answer football trivia questions under time pressure.

- **Core Loop:** Turn-based answering. Players type names. Advanced fuzzy searching matches guesses against a player database or routes to an AI referee.
- **Match Format:** "Best of 3" Rounds. Players alternate starting turns per round.
- **Loss Condition (Per Round):** A player loses the round if they accumulate 3 strikes (wrong answers, already taken players, or timeouts).
- **Turn Timer:** Strict 10-second timer per turn.
- **Current Modes:** Ranked Matchmaking (1v1 Queue), Play vs Friend (Private Room Code).
- **Future Modes:** Survival Mode (Sudden Death), 2v2 Co-op, Daily Challenges.

## 2. Tech Stack & Infrastructure (Current & Planned)

- **Frontend (Deployment: Vercel):** Next.js (App Router), React, Tailwind CSS, Zustand, Socket.io-client.
- **Backend (Deployment: Render/Railway/AWS):** NestJS (REST API + WebSockets).
- **Database (Deployment: Supabase):** PostgreSQL (via Prisma ORM) utilizing `pg_trgm`, `fuzzystrmatch`, `unaccent`, and eventually `pgvector`.
- **In-Memory Cache & State (Deployment: Upstash/Aiven):** Redis (matchmaking queues, live game state locking via `WATCH`/`MULTI`, turn timers).
- **AI Microservice (Deployment: Vercel/Render):** Python (FastAPI) + LangChain + LLMs (Gemini/OpenAI) for dynamic question generation and AI refereeing.

## 3. Database Schema (Prisma - Current)

/_ Note: The following is the Prisma schema structure
User: id(uuid), email(unique), username(unique), passwordHash, mmr(default 1000), wins, gamesPlayed
FootballPlayer: id(uuid), name, aliases(string[]), clubs(string[]), activeYear
_/

## 4. Completed Features: Backend Engine (NestJS & Redis)

- **Auth:** JWT-based registration and login. Secured WebSocket Gateway.
- **Matchmaking Service:** - Users join a Redis queue (`matchmaking_queue`).
  - Worker pops 2 players -> generates `gameSessionId` -> emits `matchFound`.
  - Supports Private Rooms with 6-character codes.
- **Advanced Fuzzy Search Engine:** - Scales tolerance: ≤ 4 chars (0 typos), ≥ 5 (1 typo), ≥ 8 (2 typos).
  - Uses Levenshtein distance, Trigram `word_similarity`, and `unaccent`.
  - Rejects inputs if the length difference is > 3 characters to prevent spam.
- **Robust Game State Machine (Redis):**
  - Tracks `currentTurn`, `overallScores`, `scores`, `strikes`, `guessedPlayers`, and `roundHistory`.
  - Alternates starting player per round.
  - Handles 4-second cinematic delays between rounds with `roundOver` and `nextRoundStarted` events.
- **Server-Side Timers:** Integrates `NodeJS.Timeout` mapping to auto-assign strikes and flip turns at 10 seconds. Protected by Redis `WATCH` transactions for atomicity.

## 5. Completed Features: Frontend App (Next.js)

- **State Management:** Uses Zustand for a centralized `socketStore` (handling singleton connections) and `authStore`.
- **Matchmaking Lobby:** UI for Ranked Queue and Private Matches. Auto-redirects to `/game/[id]` on match success.
- **Live Game Board (/game/[id]):**
  - Dynamic mapping of player names (JWT usernames) to UI cards.
  - Visual glowing indicators for active turn and auto-focuses text input.
  - 10-second countdown timer UI synchronized with the backend.
  - Dynamic Strike UI (Red X's update based on backend state).
- **Endgame Screen:**
  - Safely unmounts the game board completely when `status === 'match_completed'`.
  - Displays a centered, high-fidelity Match Summary modal.
  - Accurately renders `roundHistory` cards showing correct scores for Round 1, 2, and 3.

## 6. Phase Roadmap: What Needs to be Built Next

### Phase 6A: AI Integration & "Infinite Content" (Python Microservice)

1. **The "Infinite Content" Engine:** A Python LangChain script to scrape football stats and generate thousands of unique trivia questions with difficulty ratings.
2. **The Real-Time "AI Referee":** Bypass strict Postgres fuzzy search for subjective questions. Send `{ question, guess }` to the FastAPI LLM microservice to return `{ "isCorrect": true/false }`.
3. **Semantic Search (pgvector via Supabase):** Generate vector embeddings for player names to match obscure nicknames (e.g., "Dibu" -> "Emiliano Martinez") using vector math.

### Phase 6B: Competitive MMR & Advanced Logic

1. **Elo / MMR System:** Implement a standardized Elo formula on the backend. Calculate point exchange based on opponent strength and update the `User` database upon `matchOver`.
2. **Skill-Based Matchmaking (SBMM):** Update the Redis matchmaking queue to pair players within specific MMR brackets instead of purely random matching.
3. **Advanced Game Mechanics:** Introduce "Lifelines" or special abilities (e.g., "Skip Turn", "Hint") that cost in-game currency.

### Phase 6C: UI/UX Polish & Architecture Refactoring

1. **Animations & Transitions:** Integrate Framer Motion for smooth modal popups, strike animations, and point ticking.
2. **Backend Refactoring:** Modularize the NestJS architecture to separate game state, socket emission, and database queries for better scalability.
3. **Global Leaderboards:** Build a UI to display top players globally and filtered by friend lists.

### Phase 6D: Production Deployment Phase

1. **Supabase:** Migrate local Postgres to Supabase. Enable the `pgvector` extension.
2. **Vercel:** Deploy Next.js frontend with appropriate environment variables for the production API.
3. **Cloud Backend:** Deploy NestJS and Redis to a provider like Render, Railway, or AWS (ensuring sticky sessions or proper WebSocket load balancing).
