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

```prisma
model User {
  id             String   @id @default(uuid())
  email          String   @unique
  username       String   @unique
  passwordHash   String
  isVerified     Boolean  @default(false)
  mmr            Int      @default(1000) // Matchmaking rating
  gamesPlayed    Int      @default(0)
  wins           Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model FootballPlayer {
  id         String   @id @default(uuid())
  name       String   // Full name (e.g., "Lionel Messi")
  aliases    String[] // Known nicknames or alternate spellings
  clubs      String[]
  activeYear Int
}

4. Completed Features: Backend Engine (NestJS & Redis)
Auth: JWT-based registration and login. Secured WebSocket Gateway.

Matchmaking Service: - Users join a Redis queue (matchmaking_queue). Pop 2 players -> generate gameSessionId -> emit matchFound.

Supports Private Rooms with 6-character codes.

Advanced Fuzzy Search Engine: - Scales tolerance: ≤ 4 chars (0 typos), ≥ 5 (1 typo), ≥ 8 (2 typos).

Uses Levenshtein distance, Trigram word_similarity, and unaccent.

Rejects inputs if the length difference is > 3 characters.

Robust Game State Machine (Redis):

Tracks currentTurn, overallScores, scores, strikes, guessedPlayers, and roundHistory.

Alternates starting player per round. Handles 4-second cinematic delays between rounds.

Server-Side Timers: Integrates NodeJS.Timeout mapping to auto-assign strikes and flip turns at 10 seconds. Protected by Redis WATCH transactions.

5. Completed Features: Frontend App (Next.js)
State Management: Bulletproof socketStore (prevents React Strict Mode duplicate connections) and authStore.

Matchmaking Lobby: UI for Ranked Queue and Private Matches. Auto-redirects to /game/[id].

Live Game Board (/game/[id]):

Dynamic mapping of player names (JWT usernames) to UI cards.

Visual glowing indicators for active turn and auto-focuses text input.

10-second countdown timer UI synchronized with the backend.

Endgame Screen:

Safely unmounts the game board completely when status === 'match_completed'.

Displays a centered Match Summary modal mapping through roundHistory.

6. Phase Roadmap: What Needs to be Built Next
Phase 6A: AI Integration & "Infinite Content" (Python Microservice)
The "Infinite Content" Engine: A Python LangChain script to scrape football stats and generate thousands of unique trivia questions with difficulty ratings.

The Real-Time "AI Referee": Bypass strict Postgres fuzzy search for subjective questions. Send { question, guess } to the FastAPI LLM microservice to return { "isCorrect": true/false }.

Semantic Search (pgvector via Supabase): Generate vector embeddings for player names to instantly match obscure nicknames (e.g., "Dibu" -> "Emiliano Martinez") using math instead of string-distance algorithms.

Phase 6B: Competitive MMR & Advanced Logic
Elo / MMR System: Implement a standardized Elo formula on the backend. When a match ends, calculate the point exchange based on both players' current MMR and update the User database.

Skill-Based Matchmaking (SBMM): Update the Redis matchmaking queue to pair players within specific MMR brackets instead of purely random popping.

Advanced Game Mechanics: Introduce "Lifelines" or special abilities (e.g., "Skip Turn", "Hint") that cost in-game currency or can be used once per match.

Phase 6C: UI/UX Polish & Better Frontend/Backend Architecture
Animations & Transitions: Add Framer Motion to the Next.js frontend for smooth modal popups, strike animations, and point ticking.

Backend Refactoring: Clean up the NestJS architecture. Separate game state logic, socket emission logic, and database queries into stricter, more modular services to prepare for massive scaling.

Global Leaderboards: Build a UI to display top players globally and amongst friends.

Phase 6D: Production Deployment Phase
Supabase: Migrate the local Postgres database to a managed Supabase project. Enable the pgvector extension natively.

Vercel: Deploy the Next.js frontend to Vercel. Set up environment variables for the production NestJS backend URL.

Backend Cloud Host: Deploy the NestJS server and Redis instance to a scalable cloud provider (e.g., Render, Railway, or AWS ECS) ensuring WebSocket ports are correctly exposed and load balanced.
```
