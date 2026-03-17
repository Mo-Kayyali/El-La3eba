"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Crown, Swords, ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useSocketStore } from "@/src/store/socketStore";

type Player = {
  id?: string | number;
  username?: string;
  email?: string;
  [key: string]: unknown;
};

type GameState = {
  // Backend state uses player IDs (string[]). Keep this flexible to avoid UI breakage.
  players?: Array<string | number | Player>;
  currentTurn?: string | number | null;
  scores?: Record<string, number> | number[];
  strikes?: Record<string, number> | number[];
  guessedPlayers?: string[];
  currentQuestion?: string;
  currentRound?: number;
  overallScores?: Record<string, number> | number[];
  status?: "in_progress" | "match_completed" | string;
  winner?: Player | string | number | null;
  playerNames?: Record<string, string>;
  roundHistory?: Array<{
    round: number;
    winner: string | number;
    scores: Record<string, number>;
  }>;
  [key: string]: unknown;
};

function toId(v: unknown) {
  if (typeof v === "string" || typeof v === "number") return v;
  return undefined;
}

function playerEntryToId(entry: unknown) {
  if (typeof entry === "string" || typeof entry === "number") return entry;
  if (entry && typeof entry === "object") return toId((entry as Player)?.id);
  return undefined;
}

function coerceString(v: unknown) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function getByKeyOrIndex(
  value: Record<string, number> | number[] | undefined,
  key: string | undefined,
  index: number,
) {
  if (!value) return 0;
  if (Array.isArray(value)) return value[index] ?? 0;
  if (!key) return 0;
  return value[key] ?? 0;
}

export default function GamePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const { user, accessToken, isAuthenticated } = useAuthStore();
  const { socket, isConnected, connectSocket } = useSocketStore();

  const gameSessionId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.id]);

  const userId = toId(user?.id);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [guess, setGuess] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(10);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionSecondsLeft, setTransitionSecondsLeft] = useState<number>(0);
  const guessInputRef = useRef<HTMLInputElement | null>(null);
  const [showMatchOverUI, setShowMatchOverUI] = useState(false);

  const toastTimer = useRef<number | null>(null);
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!accessToken || !isAuthenticated) {
      router.replace("/");
      return;
    }
    // If the user hard-refreshed on /game/:id, the socket store may be "dead".
    // Re-connect defensively (store will no-op if already connected).
    connectSocket(accessToken);
  }, [accessToken, connectSocket, isAuthenticated, router]);

  useEffect(() => {
    if (!socket || !gameSessionId) return;
    if (!isConnected) return;

    // Join room as soon as the socket is connected (covers route transitions + hard refresh).
    socket.emit("joinGameRoom", { gameSessionId });

    const onGameStateUpdated = (payload: any) => {
      // Extract the nested state if it exists, otherwise use the raw payload
      const actualState = payload?.state || payload;
      setGameState(actualState ?? null);

      // Optional: You can also use payload.lastGuess here to show a toast notification!
      // if (payload?.lastGuess) {
      //   console.log("Last guess was:", payload.lastGuess);
      // }
    };

    const onNextRoundStarted = (payload: GameState) => {
      const actualState = (payload as any)?.state || payload;
      setGameState(actualState ?? null);
      setIsTransitioning(false);
      setTransitionSecondsLeft(0);
      const round = (actualState as any)?.currentRound;
      showToast(`Round ${typeof round === "number" ? round : "?"} Started!`);
    };

    const onMatchOver = (payload: GameState) => {
      const actualState = (payload as any)?.state || payload;
      setGameState(actualState ?? null);
      setIsTransitioning(false);
      setTransitionSecondsLeft(0);
      showToast("Match Over");
    };

    const onRoundOver = (payload: any) => {
      const nextRoundIn =
        typeof payload?.nextRoundIn === "number" ? payload.nextRoundIn : 4;
      setIsTransitioning(true);
      setTransitionSecondsLeft(Math.max(0, Math.floor(nextRoundIn)));
      const winner = payload?.winner;
      showToast(
        `Round over${winner ? ` • Winner: ${String(winner)}` : ""} — next round soon`,
      );
    };

    socket.on("gameStateUpdated", onGameStateUpdated);
    socket.on("nextRoundStarted", onNextRoundStarted);
    socket.on("matchOver", onMatchOver);
    socket.on("roundOver", onRoundOver);

    return () => {
      socket.off("gameStateUpdated", onGameStateUpdated);
      socket.off("nextRoundStarted", onNextRoundStarted);
      socket.off("matchOver", onMatchOver);
      socket.off("roundOver", onRoundOver);
    };
  }, [gameSessionId, isConnected, socket]);

  const player1Id = useMemo(
    () => playerEntryToId(gameState?.players?.[0]),
    [gameState?.players],
  );
  const player2Id = useMemo(
    () => playerEntryToId(gameState?.players?.[1]),
    [gameState?.players],
  );

  const [leftPlayerId, rightPlayerId] = useMemo(() => {
    if (userId === undefined) return [player1Id, player2Id] as const;
    if (player1Id === undefined && player2Id === undefined)
      return [undefined, undefined] as const;
    if (userId === player1Id) return [player1Id, player2Id] as const;
    if (userId === player2Id) return [player2Id, player1Id] as const;
    // If somehow a spectator/unknown user, keep original order.
    return [player1Id, player2Id] as const;
  }, [player1Id, player2Id, userId]);

  const leftId = coerceString(leftPlayerId);
  const rightId = coerceString(rightPlayerId);

  const currentTurnId = gameState?.currentTurn;
  const isMyTurn = userId !== undefined && currentTurnId === userId;
  const isMatchOver = gameState?.status === "match_completed";

  useEffect(() => {
    if (!isMatchOver) {
      setShowMatchOverUI(false);
      return;
    }
    const id = window.setTimeout(() => setShowMatchOverUI(true), 350);
    return () => window.clearTimeout(id);
  }, [isMatchOver]);

  const leftIsActive =
    gameState?.currentTurn !== undefined && gameState?.currentTurn !== null
      ? gameState?.currentTurn === leftPlayerId
      : false;
  const rightIsActive =
    gameState?.currentTurn !== undefined && gameState?.currentTurn !== null
      ? gameState?.currentTurn === rightPlayerId
      : false;

  const leftIsMe = userId !== undefined && leftPlayerId === userId;
  const rightIsMe = userId !== undefined && rightPlayerId === userId;

  const winnerId = useMemo(() => {
    const w = gameState?.winner;
    if (typeof w === "string" || typeof w === "number") return w;
    if (w && typeof w === "object") return toId((w as Player)?.id);
    return undefined;
  }, [gameState?.winner]);

  const normalizedRoundHistory = useMemo(() => {
    const history = Array.isArray(gameState?.roundHistory)
      ? gameState?.roundHistory
      : [];
    const byRound = new Map<number, NonNullable<GameState["roundHistory"]>[number]>();
    for (const h of history) {
      if (!h || typeof h.round !== "number") continue;
      byRound.set(h.round, h);
    }

    if (isMatchOver) {
      const r = typeof gameState?.currentRound === "number" ? gameState.currentRound : undefined;
      const strikes = gameState?.strikes;
      const scores = gameState?.scores;
      const hasRound = r !== undefined && byRound.has(r);
      const canInfer = r !== undefined && !hasRound && strikes !== undefined && scores !== undefined;

      if (canInfer) {
        const p1 = player1Id;
        const p2 = player2Id;
        const p1Key = coerceString(p1);
        const p2Key = coerceString(p2);
        const p1Strikes = getByKeyOrIndex(strikes as any, p1Key, 0);
        const p2Strikes = getByKeyOrIndex(strikes as any, p2Key, 1);
        const roundWinner =
          p1Strikes >= 3 ? p2Key : p2Strikes >= 3 ? p1Key : coerceString(winnerId);

        const leftPts = getByKeyOrIndex(scores as any, leftId, 0);
        const rightPts = getByKeyOrIndex(scores as any, rightId, 1);

        byRound.set(r, {
          round: r,
          winner: roundWinner,
          scores: { [leftId]: leftPts, [rightId]: rightPts },
        });
      }
    }

    return ([1, 2, 3] as const).map((round) => ({
      round,
      entry: byRound.get(round),
    }));
  }, [
    gameState?.currentRound,
    gameState?.roundHistory,
    gameState?.scores,
    gameState?.strikes,
    isMatchOver,
    leftId,
    player1Id,
    player2Id,
    rightId,
    winnerId,
  ]);

  useEffect(() => {
    // Visual 10-second countdown; resets immediately on turn changes.
    setTurnSecondsLeft(10);
    if (isMatchOver) return;
    if (gameState?.currentTurn === null || gameState?.currentTurn === undefined)
      return;

    const id = window.setInterval(() => {
      setTurnSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [gameState?.currentTurn, isMatchOver]);

  useEffect(() => {
    if (isMatchOver) return;
    if (!isMyTurn) return;
    const id = window.setTimeout(() => guessInputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [gameState?.currentTurn, isMatchOver, isMyTurn]);

  useEffect(() => {
    if (!isTransitioning) return;
    setTurnSecondsLeft(10);
    if (transitionSecondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setTransitionSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isTransitioning, transitionSecondsLeft]);

  const currentRound = gameState?.currentRound ?? 1;
  const question = gameState?.currentQuestion ?? "Waiting for question...";
  const guessedPlayers = gameState?.guessedPlayers ?? [];

  const leftRoundScore = getByKeyOrIndex(gameState?.scores, leftId, 0);
  const rightRoundScore = getByKeyOrIndex(gameState?.scores, rightId, 1);
  const leftStrikes = Math.min(
    3,
    Math.max(0, getByKeyOrIndex(gameState?.strikes, leftId, 0)),
  );
  const rightStrikes = Math.min(
    3,
    Math.max(0, getByKeyOrIndex(gameState?.strikes, rightId, 1)),
  );
  const leftOverall = getByKeyOrIndex(gameState?.overallScores, leftId, 0);
  const rightOverall = getByKeyOrIndex(gameState?.overallScores, rightId, 1);

  const playerNames = (gameState?.playerNames ?? {}) as Record<string, string>;
  const currentTurnName = useMemo(() => {
    const id = coerceString(currentTurnId);
    if (!id) return "";
    return playerNames[id] ?? id;
  }, [currentTurnId, playerNames]);

  const winnerLabel = useMemo(() => {
    const w = gameState?.winner;
    if (!w) return "";
    if (typeof w === "string" || typeof w === "number") {
      const id = coerceString(w);
      return playerNames[id] ?? id;
    }
    const p = w as Player;
    return p?.username ?? p?.email ?? coerceString(p?.id) ?? "Winner";
  }, [gameState?.winner, playerNames]);

  const canSubmit =
    !!socket?.connected &&
    !!gameSessionId &&
    !isMatchOver &&
    isMyTurn &&
    !isTransitioning;

  const submitGuess = () => {
    const trimmed = guess.trim();
    if (!trimmed || !canSubmit) return;
    socket?.emit("submitGuess", { gameSessionId, guessName: trimmed });
    setGuess("");
  };

  const displayName = (id: string | number | undefined, fallback: string) => {
    if (id === undefined || id === null) return fallback;
    const key = coerceString(id);
    return playerNames[key] ?? fallback;
  };

  const timerLabel = useMemo(() => {
    const s = Math.max(0, Math.min(10, turnSecondsLeft));
    return `0:${String(s).padStart(2, "0")} left`;
  }, [turnSecondsLeft]);

  function GameOverCenterStage() {
    const [seconds, setSeconds] = useState(15);

    useEffect(() => {
      setSeconds(15);
      const id = window.setInterval(() => {
        setSeconds((prev) => Math.max(0, prev - 1));
      }, 1000);

      return () => window.clearInterval(id);
    }, []);

    useEffect(() => {
      if (seconds !== 0) return;
      router.push("/lobby");
    }, [router, seconds]);

    return (
      <section className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-44 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="absolute -bottom-52 left-1/3 h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_55%)]" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {winnerLabel || "Winner"}
          </h2>

          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-zinc-200">
            <Crown className="h-4 w-4 text-amber-200" />
            <span className="font-semibold text-white">Final (BO3)</span>
            <span className="text-zinc-400">•</span>
            <span className="font-semibold text-white">
              {leftOverall} - {rightOverall}
            </span>
          </div>

          <div className="mt-7 overflow-x-auto">
            <div className="mx-auto flex w-fit gap-4 px-1">
              {normalizedRoundHistory.map(({ round, entry }) => {
                const w = entry?.winner;
                const winnerName =
                  w !== undefined && w !== null
                    ? playerNames[coerceString(w)] ?? String(w)
                    : "—";
                const leftPts = entry?.scores ? entry.scores[leftId] ?? 0 : 0;
                const rightPts = entry?.scores ? entry.scores[rightId] ?? 0 : 0;

                return (
                  <div
                    key={round}
                    className="min-w-[280px] rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-left sm:min-w-[320px]"
                  >
                    <p className="text-xs font-semibold tracking-[0.22em] text-zinc-400">
                      ROUND {round}
                    </p>
                    <p className="mt-4 text-4xl font-extrabold tracking-tight text-white">
                      {leftPts} <span className="text-zinc-500">-</span>{" "}
                      {rightPts}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-zinc-200">
                      Winner: <span className="text-white">{winnerName}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => router.replace("/lobby")}
            className="mt-7 w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-6 py-4 text-base font-semibold text-black transition hover:brightness-110"
          >
            Return to Lobby Now
          </button>

          <p className="mt-4 text-xs text-zinc-400">
            Returning automatically in{" "}
            <span className="font-semibold text-zinc-200">{seconds}s</span>
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060a] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-48 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute -bottom-48 right-[-140px] h-[560px] w-[560px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_35%,rgba(0,0,0,0.35))]" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.28em] text-zinc-400">EL-LA3EBA</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              Live Match
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
                <Swords className="h-4 w-4 text-cyan-200/90" />
                Best of 3:{" "}
                <span className="font-semibold text-white">
                  {leftOverall} - {rightOverall}
                </span>
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
                Round{" "}
                <span className="ml-2 font-semibold text-white">
                  {currentRound}
                </span>
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1.5 ${
                  socket?.connected
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.06] text-zinc-300"
                }`}
              >
                {socket?.connected ? "Online" : "Connecting..."}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/lobby")}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.09] hover:border-white/20 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Lobby
            </button>
          </div>
        </header>

        {toast && (
          <div className="mt-6">
            <div className="mx-auto w-fit rounded-2xl border border-white/10 bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-xl">
              {toast}
            </div>
          </div>
        )}

        <main className="relative mt-8 grid gap-6 lg:grid-cols-[1fr_1.25fr_1fr]">
          <section
            className={`relative overflow-hidden rounded-3xl border bg-white/[0.06] p-6 backdrop-blur-xl transition ${
              !isMatchOver && leftIsActive
                ? "border-emerald-400/40 ring-4 ring-emerald-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                : "border-white/10"
            } ${
              isMatchOver
                ? "opacity-35 pointer-events-none"
                : !leftIsActive && (gameState?.currentTurn ?? null) !== null
                  ? "opacity-50"
                  : ""
            }`}
          >
            <div className="absolute inset-0 pointer-events-none opacity-0 [mask-image:radial-gradient(circle_at_30%_20%,black,transparent_70%)] lg:opacity-100">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-fuchsia-500/5" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-400">
                    PLAYER 1
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    {displayName(leftPlayerId, "Waiting...")}
                    {leftIsMe && (
                      <span className="ml-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-200">
                        You
                      </span>
                    )}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-300">
                    Round points:{" "}
                    <span className="font-semibold text-white">
                      {leftRoundScore}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                  <p className="text-[10px] tracking-[0.22em] text-zinc-400">
                    MATCH
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-white">
                    {leftOverall}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-wide text-zinc-400">
                  STRIKES
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${
                        i < leftStrikes
                          ? "border-red-500 bg-red-500/20 text-red-500"
                          : "border-white/10 bg-white/[0.04] text-zinc-500"
                      }`}
                    >
                      <X
                        className="h-4 w-4"
                        strokeWidth={2.5}
                        fill={i < leftStrikes ? "currentColor" : "none"}
                      />
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
                <span className="text-zinc-400">Status:</span>{" "}
                <span
                  className={`font-semibold ${
                    leftIsActive ? "text-emerald-200 animate-pulse" : "text-white"
                  }`}
                >
                  {leftIsActive
                    ? leftIsMe
                      ? "Your Turn"
                      : "Opponent's Turn"
                    : leftIsMe
                      ? "Opponent's Turn"
                      : "Your Turn"}
                </span>
              </div>
            </div>
          </section>

          {isMatchOver ? (
            <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl opacity-35 pointer-events-none" />
          ) : (
            <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-400">
                    CURRENT QUESTION
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white leading-snug">
                    {question}
                  </h3>
                </div>
                <div
                  className={`shrink-0 rounded-2xl border px-3 py-2 text-sm font-semibold ${
                    isMyTurn
                      ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.06] text-zinc-300"
                  }`}
                >
                  {isTransitioning
                    ? "Transition"
                    : isMyTurn
                      ? "Your turn"
                      : "Opponent’s turn"}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <p className="text-xs font-semibold tracking-[0.22em] text-zinc-400">
                  {isTransitioning ? "NEXT ROUND" : "TURN TIMER"}
                </p>
                <p
                  className={`text-lg font-semibold ${
                    !isTransitioning && turnSecondsLeft <= 3
                      ? "text-red-200"
                      : "text-white"
                  }`}
                >
                  {isTransitioning
                    ? transitionSecondsLeft > 0
                      ? `${transitionSecondsLeft}s`
                      : "Starting..."
                    : timerLabel}
                </p>
              </div>

              <div className="mt-6">
                {isTransitioning ? (
                  <div className="rounded-3xl border border-white/10 bg-black/30 p-5 text-center">
                    <p className="text-sm font-semibold text-white">
                      Round Over! Next round starting in...
                    </p>
                    <p className="mt-2 text-2xl font-extrabold text-cyan-100">
                      {transitionSecondsLeft > 0
                        ? `${transitionSecondsLeft}s`
                        : "Starting..."}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1 rounded-2xl border border-white/10 bg-black/30 p-3">
                      <label className="block text-xs font-semibold tracking-wide text-zinc-400">
                        YOUR GUESS
                      </label>
                      <input
                        ref={guessInputRef}
                        value={guess}
                        onChange={(e) => setGuess(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") submitGuess();
                        }}
                        disabled={!canSubmit}
                        placeholder={
                          canSubmit
                            ? "Type a player name..."
                            : "Waiting for your turn..."
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>

                    <button
                      disabled={!canSubmit || !guess.trim()}
                      onClick={submitGuess}
                      className={`group relative overflow-hidden rounded-2xl px-5 py-4 text-sm font-semibold transition ${
                        !canSubmit || !guess.trim()
                          ? "cursor-not-allowed bg-white/10 text-zinc-300"
                          : "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black hover:brightness-110"
                      }`}
                    >
                      <span className="relative z-10">Submit Guess</span>
                      {canSubmit && guess.trim() && (
                        <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                          <span className="absolute inset-[-2px] rounded-2xl bg-gradient-to-r from-fuchsia-500/40 to-cyan-400/40 blur-xl" />
                        </span>
                      )}
                    </button>
                  </div>
                )}

                <div className="mt-5 rounded-3xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">
                      Activity Feed
                    </p>
                    <span className="text-xs text-zinc-400">
                      Taken:{" "}
                      <span className="font-semibold text-zinc-200">
                        {guessedPlayers.length}
                      </span>
                    </span>
                  </div>

                  {guessedPlayers.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-300">
                      No guesses yet. Be the first to claim a player.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {guessedPlayers.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-zinc-200"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {!isMyTurn && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-zinc-300">
                    Waiting for{" "}
                    <span className="font-semibold text-white">
                      {currentTurnName || "opponent"}
                    </span>{" "}
                    to play.
                  </div>
                )}
              </div>
            </section>
          )}

          <section
            className={`relative overflow-hidden rounded-3xl border bg-white/[0.06] p-6 backdrop-blur-xl transition ${
              !isMatchOver && rightIsActive
                ? "border-emerald-400/40 ring-4 ring-emerald-500/50 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                : "border-white/10"
            } ${
              isMatchOver
                ? "opacity-35 pointer-events-none"
                : !rightIsActive && (gameState?.currentTurn ?? null) !== null
                  ? "opacity-50"
                  : ""
            }`}
          >
            <div className="absolute inset-0 pointer-events-none opacity-0 [mask-image:radial-gradient(circle_at_70%_20%,black,transparent_70%)] lg:opacity-100">
              <div className="absolute inset-0 bg-gradient-to-bl from-fuchsia-500/10 to-cyan-400/5" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-400">
                    PLAYER 2
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    {displayName(rightPlayerId, "Waiting...")}
                    {rightIsMe && (
                      <span className="ml-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-200">
                        You
                      </span>
                    )}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-300">
                    Round points:{" "}
                    <span className="font-semibold text-white">
                      {rightRoundScore}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                  <p className="text-[10px] tracking-[0.22em] text-zinc-400">
                    MATCH
                  </p>
                  <p className="mt-0.5 text-lg font-semibold text-white">
                    {rightOverall}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-wide text-zinc-400">
                  STRIKES
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${
                        i < rightStrikes
                          ? "border-red-500 bg-red-500/20 text-red-500"
                          : "border-white/10 bg-white/[0.04] text-zinc-500"
                      }`}
                    >
                      <X
                        className="h-4 w-4"
                        strokeWidth={2.5}
                        fill={i < rightStrikes ? "currentColor" : "none"}
                      />
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
                <span className="text-zinc-400">Status:</span>{" "}
                <span
                  className={`font-semibold ${
                    rightIsActive
                      ? "text-emerald-200 animate-pulse"
                      : "text-white"
                  }`}
                >
                  {rightIsActive
                    ? rightIsMe
                      ? "Your Turn"
                      : "Opponent's Turn"
                    : rightIsMe
                      ? "Opponent's Turn"
                      : "Your Turn"}
                </span>
              </div>
            </div>
          </section>

          {showMatchOverUI && (
            <div className="absolute inset-0 z-20 flex items-center justify-center px-3 sm:px-6">
              <div className="absolute inset-0 rounded-3xl bg-black/55 backdrop-blur-[2px]" />
              <div className="relative z-10 w-full">
                <GameOverCenterStage />
              </div>
            </div>
          )}
        </main>

        {!gameState && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-sm text-zinc-300">
            Loading game state… If this takes too long, make sure the socket is
            connected and the server is emitting `gameStateUpdated`.
          </div>
        )}
      </div>
    </div>
  );
}
