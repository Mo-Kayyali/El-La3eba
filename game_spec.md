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
