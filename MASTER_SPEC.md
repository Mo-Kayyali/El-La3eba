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

> **Migration applied:** `20260716000000_structured_schema_v2` — FootballPlayer dropped,
> full structured schema in place. Prisma client regenerated.

```
Enum Role              PLAYER | ADMIN
Enum Timeframe         CURRENT | PAST | BOTH
Enum Region            EUROPE | AFRICA | ASIA | NORTH_AMERICA | SOUTH_AMERICA | OCEANIA | WORLD
Enum CompetitionType   DOMESTIC_LEAGUE | DOMESTIC_CUP | CONTINENTAL_CLUB_COMPETITION | INTERNATIONAL_TOURNAMENT | GLOBAL_CLUB_CHAMPIONSHIP | DOMESTIC_SUPER_CUP | CONTINENTAL_SUPER_CUP
Enum Position          GK | RB | CB | LB | RWB | LWB | CDM | CM | CAM | RM | LM | RW | LW | CF | ST
Enum PreferredFoot     LEFT | RIGHT | BOTH
Enum GameMode          STRIKES | TOP_10 | PHOTO_GUESS | LINEUP
Enum LogicOperator     AND | OR
Enum QuestionScope     NATIONAL | INTERNATIONAL | BOTH
Enum AnswerType        FILTER | LIST
Enum FilterType        COMPETITION | NATIONALITY | CLUB | POSITION | POSITION_CATEGORY
Enum PositionCategory  GOALKEEPER | DEFENDER | MIDFIELDER | FORWARD
Enum PlayerStatusFilter ANY | CURRENT_ONLY | RETIRED_ONLY
Enum SuggestionStatus  PENDING | APPROVED | REJECTED
User
id                     uuid (pk)
email                  string (unique)
username               string (unique)
passwordHash           string
isVerified              boolean (default false)
mmr                    int (default 1000)
wins                   int
gamesPlayed            int
offlineDisconnectCount int (default 0)
lastDisconnectAt       datetime?
createdAt              datetime
updatedAt              datetime
role                   Role (default PLAYER)          ← NEW
// Indexes: B-tree on mmr (leaderboard reads)
Country
id    string (pk, ISO 3166-1 alpha-3 code e.g. "ENG")
name  string
Competition
id           uuid (pk)
name         string
type         CompetitionType
countryCode  string? (fk -> Country)
region       Region?
tier         int?
createdAt    datetime
createdBy    string?
Club
id                   uuid (pk)
name                 string
aliases              string[]
countryCode          string (fk -> Country)
currentCompetitionId uuid? (fk -> Competition)
competitions         string[]  // denormalised historical list; GIN indexed (derived from ClubCompetition)
logoUrl              string?
createdAt            datetime
createdBy            string?
// Indexes: GIN on competitions[]
ClubCompetition
id            uuid (pk)
clubId        uuid (fk -> Club, cascade delete)
competitionId uuid (fk -> Competition, cascade delete)
// Unique: (clubId, competitionId)
// Indexes: B-tree on clubId, competitionId
Player  (replaces FootballPlayer — clean slate, no data migration)
id              uuid (pk)
firstName       string
lastName        string
name            string  // canonical display name
aliases         string[]
nationality     string  // Country.id (ISO alpha-3)
dateOfBirth     datetime?
heightCm        int?
preferredFoot   PreferredFoot?
positionCategories PositionCategory[]
positions       Position[]
primaryPosition Position?
isRetired       boolean (default false)
currentClubId   uuid? (fk -> Club)
imageUrl        string?
clubs           string[]       // denormalised — set by PlayerDenormService only
competitions    string[]       // denormalised — set by PlayerDenormService only
createdAt       datetime
createdBy       string?
// Indexes:
//   GIN + pg_trgm (gin_trgm_ops) on name
//   GIN + pg_trgm on array_to_string_immutable(aliases,' ') — same strategy
//     as old FootballPlayer; uses an IMMUTABLE SQL wrapper because
//     array_to_string() is STABLE in Postgres 15
//   GIN on positionCategories[], positions[], clubs[], competitions[]
PlayerClub
id        uuid (pk)
playerId  uuid (fk -> Player, cascade delete)
clubId    uuid (fk -> Club, cascade delete)
startYear int?
endYear   int?   // null = ongoing
isCurrent boolean (default false)
// Indexes: B-tree on playerId, clubId
Question
id                 uuid (pk)
text               string
gameMode           GameMode
answerType         AnswerType
scope              QuestionScope (default BOTH)
logicOperator      LogicOperator? // AND or OR, populated when >1 clause
photoPlayerId      uuid? (fk -> Player)  // populated when gameMode = PHOTO_GUESS
isActive           boolean (default true)
playerStatusFilter PlayerStatusFilter (default ANY)
createdAt          datetime
updatedAt          datetime
createdBy          string?
// Indexes: gameMode; answerType
QuestionFilterClause
id              uuid (pk)
questionId      uuid (fk -> Question, cascade delete)
filterType      FilterType
filterValue     string
timeframe       Timeframe (default BOTH)
// Indexes: questionId
QuestionAnswer
id         uuid (pk)
questionId uuid (fk -> Question, cascade delete)
playerId   uuid (fk -> Player, cascade delete)
rank       int?     // TOP_10 only (1-based)
slotLabel  string?  // LINEUP only (e.g. "GK", "LB")
// Unique: (questionId, playerId)
// Indexes: questionId, playerId
Friendship
id        uuid (pk)
userId    uuid (fk -> User)
friendId  uuid (fk -> User)
status    FriendshipStatus (PENDING | ACCEPTED)
createdAt datetime
updatedAt datetime
// Directional: userId -> friendId.
OfflinePenalty
id             uuid (pk)
userId         uuid (fk -> User)
gameSessionId  string
mmrLost        int      // 0 for unrated disconnect-forfeits
acknowledgedAt datetime?
createdAt      datetime
AnswerSuggestion
id          uuid (pk)
questionId  uuid (fk -> Question, cascade delete)
playerId    uuid? (fk -> Player, cascade delete)
guessText   string
suggestedBy uuid (fk -> User, cascade delete)
comment     string?
status      SuggestionStatus (default PENDING)
reviewNote  string?
createdAt   datetime
reviewedAt  datetime?
// Indexes: (questionId, status); suggestedBy; playerId
```

## 4. Game Modes & Strategies

- **GameModeStrategy Interface:** GameGateway no longer contains any mode-specific game logic. Turn handling, strike/round-loss evaluation, and disconnect-forfeit winner assignment are now owned by a `GameModeStrategy` interface. The Gateway dynamically evaluates match-win conditions across all modes via a shared `checkBestOfNMatchWin` utility after a strategy returns `isRoundOver: true`. The gateway resolves the active strategy dynamically via `resolveStrategy(state.mode)` (`StrikesModeStrategy` or `Top10ModeStrategy`).
  - **Round-lock primitive:** `modeState.roundWinnerId` is a mode-controlled field, set atomically inside the same Redis `WATCH`/`MULTI`/`EXEC` transaction that applies a guess result. This supports future simultaneous-guess modes (e.g. Shared Clubs).
  - **Redis state shape:** The backend manages a mode-agnostic envelope (`players`, `status`, `winner`, `isRanked`, `mode`, etc.) plus a `modeState` object owned entirely by the active strategy.
  - **`handleForfeit`:** Manual/disconnect forfeit handling goes through the `handleForfeit` method on the strategy.
  - **`checkBestOfNMatchWin` threshold:** Multi-round matches use `requiredWins = Math.floor(composition.length / 2) + 1` (strict majority; e.g. N=2→2, N=4→3). This replaced `Math.ceil(composition.length / 2)`, which was wrong for even-length compositions (e.g. N=2 ended after one round win). The utility early-exits when either player reaches the threshold; when all rounds are played, higher `modeState.overallScores` wins; ties yield `winnerId: null`.

- **Fuzzy Search Guess Resolution & Ambiguity Rules:** Guess resolution in `GameGateway` uses `gameService.guessPlayer(guessName)` which ranks candidate players strictly by `matchConfidence` DESC. Resolution locks strictly to `matchedPlayers[0]` (the top candidate). The gateway does NOT iterate down lower-ranked candidates to find a fallback match that happens to validate against the active question. Both `alreadyGuessed` and `isCorrect` are evaluated against `matchedPlayers[0]` exclusively:
  - **Token-Quality Tiered Scoring:** `matchToken()` scores exact matches (`penalty = 0.0`), prefix matches (`penalty = 0.3 + min(0.3, lenDiff * 0.05)`), typo matches (`penalty = 0.25 * distance`), and substring matches (`penalty = 0.5`).
  - **Per-Token Unmatched Target Penalty:** In `evaluateMatch()`, unmatched target tokens are penalized per-token (`0.05` per unmatched token) rather than per-character (`unmatchedTChars * 0.5`). This eliminates the full-name-length confound that previously caused long-named star players (e.g. `Lionel Messi`, `Kylian Mbappe`, `Cristiano Ronaldo`) to rank below shorter-named or secondary candidates during single-token / partial-name guesses.
  - **Prominence & Name Match Tie-Breaking:** When candidates have identical `matchConfidence` (gap $\le 0.001$), tie-breaking prioritizes player prominence metadata (`aliases.length + clubs.length`), main name match (`isMainNameMatch`), and SQL trigram similarity (`w_sim` DESC).
  - **Tight Ambiguity Condition:** `matchedPlayers[0].isAmbiguous` fires **ONLY IF** two distinct candidate players have identical `matchConfidence` (gap $\le 0.001$), identical match quality (`c0.bestReason === 'exact' && c1.bestReason === 'exact'`), AND identical prominence tie-breaker metadata (`aliasesCount` and `clubsCount`). When ambiguous, `matchedPlayer` is set to `null` and registers an unmatched/ambiguous input strike rather than guessing on the player's behalf.
  - **Admin Dashboard Question Test Guess Diagnostics:** The Admin Question Editor's POST `/admin/questions/:id/test-guess` endpoint uses the exact same `gameService.guessPlayer()` and strict `matchedPlayers[0]` validation logic as live matches. In addition to `isCorrect` and `matchedPlayer`, it returns detailed candidate diagnostics for the top 5 fuzzy search matches (including player name, matched target, match confidence %, question validation status, and picked vs ambiguous status). The Admin UI renders a comprehensive match diagnostics card showing the overall status, picked player, and a breakdown table of top candidates.


- **Top 10 Mode:** Single-round, turn-based. Players alternate claiming Top 10 ranks. Correct guesses award `+rank` (1-10). Guesses on 'trap' ranks (11-13) subtract 3, 2, 1 point respectively. Turn timer timeout counts as a wrong guess. A player is skipped on their turn if they reach 3 wrong guesses. The match ends when all 10 real ranks are claimed or both players reach 3 wrong guesses. In case of a tie on score, the player with fewer wrong guesses wins; if still tied, the match ends in a genuine draw (`winnerId: null`, resulting in no MMR change).
- **Admin UI Extensions & TOP_10 Question Validation:** The Admin Dashboard Question editor allows rank values up to `13` for `TOP_10` mode, and visually highlights trap ranks 11-13 (`"11 (Trap)"`, `"12 (Trap)"`, `"13 (Trap)"`) while tagging ranks outside 1-13 as `"Invalid"`. The editor features auto-assignment of the first available rank (1..13) when adding players, rank swapping when manually changing rank numbers, and Up/Down chevron controls to shift ranks and positions with adjacent answers. `TOP_10` questions strictly require exactly 13 `QuestionAnswer` rows with ranks 1 through 13 used exactly once (no duplicates, no gaps, no missing/null ranks, no out-of-range ranks). This rule is authoritatively enforced server-side in `AdminQuestionsService.validateShape` (covering both `create` and `update` endpoints) and mirrored client-side in `handleSubmit` for immediate UX feedback. Validations for `STRIKES` and other modes remain unaffected.
- **Private Room Flow & Rematch:** Private rooms support custom rule sets configured by the host via a UI modal. This configuration (`composition: GameMode[]`, `timerConfig: Record<string, number>`) is set during the `createLobby` socket event and stored in Redis. The host receives a `roomCode` and enters a transient lobby state managed by `useLobbyStore`. Guests can join this lobby either via a direct invite (accepted via `acceptGameInvite`) or by manually entering the `roomCode` (`joinPrivateMatch`). Both paths resolve the room, join the shared Socket.io room keyed by `roomCode`, emit `lobbyStateUpdated` to both players, and place them in the shared `LobbyRoom` component. Inside the lobby, both host and guest must emit `toggleLobbyReady` to set their ready status. The host can reopen the existing room configuration from `LobbyRoom`, and `updateLobbyConfig` resets both `hostReady` and `guestReady` to `false` before broadcasting the updated lobby state to both players. The host's `Cancel Lobby` action is wrapped in the shared `ConfirmModal`; on confirm, the host's `lobbyCancelledByHost` notification is emitted to the guest before the room is destroyed. Once both players are ready, the host can emit `startLobbyMatch`, which initializes the `GameState` envelope using the host's configuration, atomically deletes `user_active_lobby:{userId}` for both players in Redis, and transitions both players into the match via a `matchFound` event (which clears `activeLobbyRoomCode` in client state). If a player leaves the lobby, the room resets to `waiting_for_guest`; if the host cancels, the room is destroyed. When a match originating from a private lobby completes and both players accept a rematch ("Play Again"), the gateway recreates/restores a private lobby in Redis with the exact preserved `composition` and `timerConfig`, resetting both players to `hostReady: false` and `guestReady: false` in `LobbyRoom`, and emits `rematchStarting` with `{ roomCode }` which automatically updates `useAuthStore` and routes both clients back to `/lobby/room/${roomCode}`.
- **Rematch Origin & Ranked Rematches:** When a public match ends and both players accept a rematch, the gateway creates a new game session using `handleRequestRematch`. For matches originating from a **public Ranked match**, the rematch is created with `isRanked: false` (an UNRATED rematch) to eliminate MMR manipulation risks from repeated 1v1 rematches between the same players. The frontend rematch button visually indicates this by displaying **"Play Again (Unrated)"** when `gameState.isRanked` is `true`. Matches originating from Unrated keep the standard "Play Again" label and stay unrated. Matches originating from Private Lobbies preserve their lobby-restoration behavior described above.
- **Friend game invites:** `sendGameInvite` (alias `inviteFriendToGame`) attaches a timed Redis invite to a `roomCode`. Sending a game invite with custom room configuration directly from the Friends tab creates the private room, issues the invite, updates `useAuthStore` with `activeLobbyRoomCode`, and automatically redirects the host into the lobby room (`/lobby/room/${roomCode}`). If the host already has an active lobby (`user_room:{hostId}`) with no guest, the handler **reuses that lobby** instead of cancelling and calling `createPrivateRoom` again — required when inviting from inside `LobbyRoom` so an in-room guest is not orphaned and the 3s lobby cancel cooldown is not spuriously triggered. Repeat sends to the same target within 5s hit a per-target invite cooldown (`game_invite_cooldown:${inviterId}:${inviteeId}` via `SET … NX`); blocked attempts read Redis `TTL` and return an accurate “Please wait N more second(s)…” message without blocking invites to other friends. **`cancelGameInvite`** and **`scheduleInviteExpiry`** (invite TTL) only remove invite keys/index entries and emit `inviteCancelledBySystem`; they do **not** destroy the private lobby (`cancelPrivateRoom` is for explicit host “Cancel Lobby” or lobby TTL only). Inside `LobbyRoom`, the invite panel filters the friends list to show **only currently-online users** (`presence.status !== 'offline'`), which updates live via `friendsPresenceUpdated` socket broadcasts and includes a manual refresh button as a fallback. Pending outgoing invites are strictly scoped to the active `roomCode` to prevent stale invite states from carrying over across destroyed/recreated lobbies. Once an invited friend has actually joined the lobby (host/guest presence in `lobbyState`), their invite button renders in a distinct, disabled **"Joined"** state.

## 5. Data Seeding & Enrichment

- **Current Player Database:** As of the latest Egyptian legends/current players enrichment pass, the database contains **4227** total players and **1319** clubs. The data includes updated clubs, full club histories (`PlayerClub` records), and corrected nationalities. All legacy data scripts used for importing were throwaway and removed after running.
