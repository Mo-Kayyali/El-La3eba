<div align="center">

# ⚽ El-La3eba

### Real-Time Competitive Football Trivia Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

> **Personal Project · In Active Development** — by [Mohamed Kayyali](https://github.com/Mo-Kayyali)

![Status](https://img.shields.io/badge/Status-In_Development-orange?style=flat-square)
![Language](https://img.shields.io/badge/Language-TypeScript_97.9%25-3178C6?style=flat-square)

</div>

---

## 📌 Overview

**El-La3eba** (اللعبة — "The Game") is a production-grade, real-time multiplayer football trivia platform built for Arab football fans. Players challenge each other in live 1v1 lobbies, earn MMR, climb global leaderboards, and eventually face AI-powered challenges.

The game is built around a **10-second-per-question, best-of-3 rounds, 3-strikes-per-round** format — fast, tense, and punishing if you hesitate.

---

## 🎮 Game Format

```
Match Structure
│
├── Best of 3 Rounds
│   ├── Each round: answer questions in 10 seconds
│   ├── 3 strikes in a round = round loss
│   └── First to win 2 rounds wins the match
│
├── Game Modes
│   ├── 🏆 Ranked  — MMR-based matchmaking, affects your tier
│   ├── 🎯 Unrated — Practice without MMR consequences
│   └── 🚪 Private — Invite-only lobby via code or friend link
│
└── Rank Tiers (MMR-based)
    ├── 🥉 Bronze   — 0–999
    ├── 🥈 Silver   — 1000–1499
    ├── 🥇 Gold     — 1500–1999
    └── 💎 Diamond  — 2000+
```

---

## ✨ Features

### 🌐 Real-Time Multiplayer
- **WebSocket-based game gateway** — live bidirectional communication for game state, guesses, and match events
- **15-second reconnection resilience** — if a player disconnects mid-game, a grace timer starts; the match holds until they reconnect or forfeit
- **Guess rate limiting** — sliding window (5 guesses / 1 second per user) to absorb bursts and prevent abuse
- Graceful post-match cleanup — `leaveEndedMatch` event handles room teardown without re-triggering forfeit logic

### 🏟 Lobby System
- **Join via invite code** — share a 6-character room code with anyone
- **Friend live invite** — challenge a friend directly from your friends list while they're online
- Private rooms with configurable game mode (ranked / unrated)

### 👥 Friends System
- Add friends by username
- See real-time online status
- Direct lobby invites to friends in your list

### 🏆 Leaderboard & MMR
- Global leaderboard with rank tier badges (Bronze → Diamond)
- MMR updates after every ranked match
- Redis-cached leaderboard refreshed every 10 minutes via cron job
- Rank badges rendered in-game on both player cards during a match

### 🔍 Football Knowledge Engine
- **Fuzzy player search** — PostgreSQL `pg_trgm` + `unaccent` + `levenshtein` on player names and aliases
- GIN indexes on `FootballPlayer.name` and flattened `aliases` array for fast substring and similarity matching
- `FootballPlayer` schema: `id`, `name`, `aliases[]`, `clubs[]`, `activeYear`

### 🔐 Authentication
- JWT-based auth with **Zustand persist** + `skipHydration` for seamless session hydration on hard refresh
- `AuthSessionProvider` bootstraps from `localStorage`, syncs Axios Bearer header, then validates via `GET /auth/me` — no flash of "logged out" on page reload
- Protected routes wait on `bootstrapped` flag before rendering

### 📊 Post-Match UX
- `matchOver` event includes explicit `forfeit` boolean, `forfeitedByUserId`, and `disconnectedUserId` fields
- Clean distinction between: normal match end / manual forfeit / disconnect forfeit
- Opponents who leave after match completion trigger `opponentLeft` without restarting forfeit logic

---

## 🏗 Architecture

```
El-La3eba/
├── backend/                    # NestJS API + WebSocket gateway
│   ├── src/
│   │   ├── auth/               # JWT auth, session management
│   │   ├── users/              # User profiles, MMR, stats
│   │   ├── matchmaking/        # Queue management, game session init
│   │   ├── game/               # WebSocket gateway, round logic, forfeit handling
│   │   ├── leaderboard/        # Global leaderboard, Redis caching, cron refresh
│   │   ├── friends/            # Friend list, online status, invites
│   │   └── football-player/    # Player data, fuzzy search engine
│   └── prisma/                 # Prisma schema + migrations
│
├── frontend/                   # Next.js app (App Router)
│   ├── app/                    # Pages: lobby, game, leaderboard, profile
│   ├── components/             # Game board, rank badges, lobby sidebar
│   └── lib/
│       ├── auth-store.ts       # Zustand auth store (skipHydration pattern)
│       ├── rank.ts             # MMR → tier helper (shared Bronze/Silver/Gold/Diamond)
│       └── api.ts              # Axios instance, Bearer interceptor, refreshAuthProfile
│
├── MASTER_SPEC.md              # AI developer guidelines & architecture source of truth
├── game_spec.md                # Game rules and format specification
└── docker-compose.yml          # Full stack local dev (API + DB + Redis)
```

**Key technical decisions:**

- **Redis atomicity** — all matchmaking queue ops and shared game state updates use `WATCH` + `MULTI/EXEC` transactions to prevent race conditions
- **Singleton WebSocket** — Zustand manages the socket instance as a singleton to prevent double-connections under React Strict Mode
- **Lazy deletion** for matchmaking queues — stale entries are cleaned on read, not on write
- **Prisma `$queryRaw`** for fuzzy search — raw SQL needed to leverage `pg_trgm` similarity operators not available in Prisma's query builder

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend Framework | NestJS (TypeScript) |
| Frontend Framework | Next.js (App Router) |
| State Management | Zustand |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma ORM |
| Cache / State | Redis (Upstash) |
| Real-time | WebSockets (Socket.io via NestJS Gateway) |
| Search | PostgreSQL `pg_trgm` + `unaccent` + `fuzzystrmatch` |
| DevOps | Docker, Docker Compose |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis

### Installation

```bash
# Clone the repository
git clone https://github.com/Mo-Kayyali/El-La3eba.git
cd El-La3eba

# Start infrastructure
docker-compose up db redis -d

# Backend setup
cd backend
npm install
cp .env.example .env        # Fill in DB_URL, REDIS_URL, JWT_SECRET
npx prisma migrate dev
npm run start:dev

# Frontend setup (new terminal)
cd ../frontend
npm install
cp .env.local.example .env.local   # Fill in NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL
npm run dev
```

### Full stack with Docker

```bash
docker-compose up --build
# API:      http://localhost:3000
# Frontend: http://localhost:3001
```

---

## 🗺 Roadmap

- [x] 1v1 real-time matchmaking (Ranked + Unrated)
- [x] Private lobby with invite codes
- [x] Friends system with live status
- [x] Global leaderboard with MMR tiers
- [x] 15s reconnection grace period
- [x] Fuzzy player name search
- [ ] Additional game modes (Time Attack, Tournament bracket)
- [ ] AI-powered question generation via Gemini
- [ ] AI difficulty scaling based on player MMR
- [ ] Mobile-responsive UI polish
- [ ] Spectator mode

---

## 👤 Author

**Mohamed Kayyali**

[![GitHub](https://img.shields.io/badge/GitHub-Mo--Kayyali-181717?style=flat-square&logo=github)](https://github.com/Mo-Kayyali)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Mohamed_Elkayyali-0077B5?style=flat-square&logo=linkedin)](https://www.linkedin.com/in/mohamed-elkayyali/)
[![Email](https://img.shields.io/badge/Email-mohamedelkayyali2@gmail.com-D14836?style=flat-square&logo=gmail)](mailto:mohamedelkayyali2@gmail.com)

---

<div align="center">

*مين اللاعب؟ — Who's the player?*

</div>
