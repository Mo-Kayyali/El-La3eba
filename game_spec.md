# Project: El La3eba (The Players) - Master Specification

## 1. Game Concept

"El La3eba" is a real-time, 1v1 multiplayer football quiz game. Players compete to answer football trivia questions.

- **Core Loop:** Turn-based answering. Players type names. Fuzzy searching matches guesses against a player database.
- **Win Condition:** First to 5 points.
- **Loss Condition:** 3 strikes (wrong answers or timeout) per round.
- **Modes:** Random Matchmaking, Play vs Friend (Invite Code).

## 2. Tech Stack

- **Frontend:** React (To be built later).
- **Backend:** NestJS (REST API + WebSockets).
- **Database:** PostgreSQL (via Prisma ORM) utilizing `pg_trgm` for fuzzy text searching.
- **In-Memory Cache:** Redis (for matchmaking, live game state, and temporary verification codes).

## 3. Database Schema (Prisma Initial Setup)

For the foundation, we require the following User schema:

model User {
id String @id @default(uuid())
email String @unique
username String @unique
passwordHash String
isVerified Boolean @default(false)
mmr Int @default(1000) // Matchmaking rating
gamesPlayed Int @default(0)
wins Int @default(0)
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
}

## 4. Current Mission: Phase 1 (Auth & Foundation)

Do NOT build the game logic yet. Focus strictly on the following:

1. Initialize a NestJS backend folder.
2. Create a `docker-compose.yml` for PostgreSQL and Redis.
3. Configure Prisma with the `User` model defined above.
4. Implement JWT-based Authentication (Register, Login).
5. Implement Email Verification: Generate a 6-digit code, store it in Redis with a 15-minute TTL, and create an endpoint to verify it.

## 5. Current Mission: Phase 2 (Swagger & WebSockets Foundation)

1. **API Documentation:** Install and configure `@nestjs/swagger`. Set it up in `main.ts` so I can view the UI at `/api`. Add basic Swagger decorators (`@ApiTags`, `@ApiOperation`) to the existing Auth endpoints.
2. **Real-Time Engine:** Install `@nestjs/websockets` and `@nestjs/platform-socket.io`.
3. **Gateway Setup:** Create a `GameGateway` (in a new `Game` module).
4. **Connection Handling:** Implement `handleConnection` and `handleDisconnect`. When a user connects, log their Socket ID.
5. **JWT WebSocket Auth:** Ensure the WebSocket connection is secured. The client should pass their JWT token, and the gateway should verify it before allowing the connection.

## 6. Current Mission: Phase 3 (Matchmaking & Redis Queue)

1. **Matchmaking Service:** Create a `MatchmakingService` inside the `GameModule` that utilizes Redis.
2. **Queue Logic (Random Match):**
   - Create a WebSocket event listener for `joinQueue`.
   - When a user emits `joinQueue`, push their `userId` and `socketId` into a Redis list (e.g., `matchmaking_queue`).
   - Implement an interval check that inspects this queue every 2 seconds.
3. **Session Creation:**
   - If the queue has 2 or more players, pop two players from the queue.
   - Generate a unique `gameSessionId` (UUID).
   - Emit a `matchFound` event to both players' specific Socket IDs containing the `gameSessionId`.
4. **Private Matches:** Implement `createPrivateRoom` (generates a random 6-character Redis key) and `joinPrivateRoom` (accepts the code, verifies it in Redis, and emits `matchFound`).

## 7. Current Mission: Phase 4 (Game Engine & Fuzzy Search)

**Part A: The Database (PostgreSQL & Prisma)**

1. Update `schema.prisma` to include a new model: `FootballPlayer`. It should have `id`, `name` (String), `clubs` (String array or JSON), and `activeYear` (Int).
2. Create a script or Prisma migration that automatically runs `CREATE EXTENSION IF NOT EXISTS pg_trgm;` on the PostgreSQL database.
3. Create a `GameService` that includes a `guessPlayer(guessName: string)` function. This function must use a raw Prisma query to perform a fuzzy search using `pg_trgm`'s `similarity()` function to find matches > 0.4.

**Part B: The Game State (Redis)**

1. When a `matchFound` event fires (from Phase 3), initialize a Game State object in Redis using the `gameSessionId` as the key.
2. The Game State JSON should track:
   - `players`: Array of the two user IDs.
   - `currentTurn`: The user ID of who is currently typing.
   - `scores`: { player1Id: 0, player2Id: 0 } (First to 5 wins).
   - `strikes`: { player1Id: 0, player2Id: 0 } (3 strikes = round loss).
   - `guessedPlayers`: Array of player names already successfully guessed this round.
   - `currentQuestion`: E.g., "Name a Real Madrid player from 2026".
3. Create a new WebSocket event `submitGuess`. When a player emits this, the server should:
   - Verify it is actually their turn.
   - Run the guess through the fuzzy search database.
   - Check if the player was already guessed.
   - Update the Redis Game State (add points or strikes, switch turns).
   - Emit a `gameStateUpdated` event back to both clients with the new state.
