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
  players?: Player[];
  currentTurn?: string | number | null;
  scores?: Record<string, number> | number[];
  strikes?: Record<string, number> | number[];
  guessedPlayers?: string[];
  currentQuestion?: string;
  currentRound?: number;
  overallScores?: Record<string, number> | number[];
  status?: "in_progress" | "match_completed" | string;
  winner?: Player | string | number | null;
  [key: string]: unknown;
};

function toId(v: unknown) {
  if (typeof v === "string" || typeof v === "number") return v;
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
  index: number
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
  const { socket } = useSocketStore();

  const gameSessionId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.id]);

  const userId = toId(user?.id);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [guess, setGuess] = useState("");
  const [toast, setToast] = useState<string | null>(null);

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
  }, [accessToken, isAuthenticated, router]);

  useEffect(() => {
    if (!socket?.connected || !gameSessionId) return;

    socket.emit("joinGameRoom", { gameSessionId });

    const onGameStateUpdated = (payload: GameState) => {
      setGameState(payload ?? null);
    };

    const onNextRoundStarted = (payload: GameState) => {
      setGameState(payload ?? null);
      const round = payload?.currentRound;
      showToast(`Round ${typeof round === "number" ? round : "?"} Started!`);
    };

    const onMatchOver = (payload: GameState) => {
      setGameState(payload ?? null);
      showToast("Match Over");
    };

    socket.on("gameStateUpdated", onGameStateUpdated);
    socket.on("nextRoundStarted", onNextRoundStarted);
    socket.on("matchOver", onMatchOver);

    return () => {
      socket.off("gameStateUpdated", onGameStateUpdated);
      socket.off("nextRoundStarted", onNextRoundStarted);
      socket.off("matchOver", onMatchOver);
    };
  }, [gameSessionId, socket]);

  const players = useMemo(() => gameState?.players ?? [], [gameState?.players]);
  const me = players.find((p) => toId(p?.id) === userId) ?? user ?? null;

  const [leftPlayer, rightPlayer] = useMemo(() => {
    if (players.length === 0) return [null, null] as const;
    if (!userId) return [players[0] ?? null, players[1] ?? null] as const;
    const mine = players.find((p) => toId(p?.id) === userId) ?? null;
    const other = players.find((p) => toId(p?.id) !== userId) ?? null;
    return [mine ?? players[0] ?? null, other ?? players[1] ?? null] as const;
  }, [players, userId]);

  const leftId = coerceString(leftPlayer?.id);
  const rightId = coerceString(rightPlayer?.id);

  const currentTurnId = gameState?.currentTurn;
  const isMyTurn = userId !== undefined && currentTurnId === userId;
  const isMatchOver = gameState?.status === "match_completed";

  const currentRound = gameState?.currentRound ?? 1;
  const question = gameState?.currentQuestion ?? "Waiting for question...";
  const guessedPlayers = gameState?.guessedPlayers ?? [];

  const leftRoundScore = getByKeyOrIndex(gameState?.scores, leftId, 0);
  const rightRoundScore = getByKeyOrIndex(gameState?.scores, rightId, 1);
  const leftStrikes = Math.min(3, Math.max(0, getByKeyOrIndex(gameState?.strikes, leftId, 0)));
  const rightStrikes = Math.min(3, Math.max(0, getByKeyOrIndex(gameState?.strikes, rightId, 1)));
  const leftOverall = getByKeyOrIndex(gameState?.overallScores, leftId, 0);
  const rightOverall = getByKeyOrIndex(gameState?.overallScores, rightId, 1);

  const winnerLabel = useMemo(() => {
    const w = gameState?.winner;
    if (!w) return "";
    if (typeof w === "string" || typeof w === "number") return String(w);
    const p = w as Player;
    return p?.username ?? p?.email ?? coerceString(p?.id) ?? "Winner";
  }, [gameState?.winner]);

  const canSubmit = !!socket?.connected && !!gameSessionId && !isMatchOver && isMyTurn;

  const submitGuess = () => {
    const trimmed = guess.trim();
    if (!trimmed || !canSubmit) return;
    socket?.emit("submitGuess", { gameSessionId, guess: trimmed });
    setGuess("");
  };

  const displayName = (p: Player | null, fallback: string) =>
    p?.username ?? p?.email ?? (p?.id !== undefined ? `Player ${String(p.id)}` : fallback);

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
            <h1 className="mt-2 text-2xl font-semibold text-white">Live Match</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-300">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
                <Swords className="h-4 w-4 text-cyan-200/90" />
                Best of 3:{" "}
                <span className="font-semibold text-white">
                  {leftOverall} - {rightOverall}
                </span>
              </span>
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5">
                Round <span className="ml-2 font-semibold text-white">{currentRound}</span>
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

        <main className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.25fr_1fr]">
          <section
            className={`relative overflow-hidden rounded-3xl border bg-white/[0.06] p-6 backdrop-blur-xl transition ${
              gameState?.currentTurn === toId(leftPlayer?.id)
                ? "border-cyan-400/40 shadow-[0_0_0_1px_rgba(34,211,238,0.18),0_0_50px_rgba(34,211,238,0.10)]"
                : "border-white/10"
            }`}
          >
            <div className="absolute inset-0 pointer-events-none opacity-0 [mask-image:radial-gradient(circle_at_30%_20%,black,transparent_70%)] lg:opacity-100">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-fuchsia-500/5" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-400">PLAYER 1</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    {displayName(leftPlayer, "Waiting...")}
                    {toId(leftPlayer?.id) === userId && (
                      <span className="ml-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-200">
                        You
                      </span>
                    )}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-300">
                    Round points: <span className="font-semibold text-white">{leftRoundScore}</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                  <p className="text-[10px] tracking-[0.22em] text-zinc-400">MATCH</p>
                  <p className="mt-0.5 text-lg font-semibold text-white">{leftOverall}</p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-wide text-zinc-400">STRIKES</p>
                <div className="mt-2 flex items-center gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${
                        i < leftStrikes
                          ? "border-red-500/30 bg-red-500/10 text-red-200"
                          : "border-white/10 bg-white/[0.04] text-zinc-500"
                      }`}
                    >
                      <X className="h-4 w-4" />
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
                <span className="text-zinc-400">Status:</span>{" "}
                <span className="font-semibold text-white">
                  {gameState?.currentTurn === toId(leftPlayer?.id) ? "Your side to play" : "Waiting"}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-zinc-400">CURRENT QUESTION</p>
                <h3 className="mt-2 text-xl font-semibold text-white leading-snug">{question}</h3>
              </div>
              <div
                className={`shrink-0 rounded-2xl border px-3 py-2 text-sm font-semibold ${
                  isMatchOver
                    ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                    : isMyTurn
                      ? "border-cyan-400/30 bg-cyan-500/10 text-cyan-100"
                      : "border-white/10 bg-white/[0.06] text-zinc-300"
                }`}
              >
                {isMatchOver ? "Match finished" : isMyTurn ? "Your turn" : "Opponent’s turn"}
              </div>
            </div>

            {!isMatchOver ? (
              <div className="mt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1 rounded-2xl border border-white/10 bg-black/30 p-3">
                    <label className="block text-xs font-semibold tracking-wide text-zinc-400">
                      YOUR GUESS
                    </label>
                    <input
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitGuess();
                      }}
                      disabled={!canSubmit}
                      placeholder={canSubmit ? "Type a player name..." : "Waiting for your turn..."}
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

                <div className="mt-5 rounded-3xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">Activity Feed</p>
                    <span className="text-xs text-zinc-400">
                      Taken: <span className="font-semibold text-zinc-200">{guessedPlayers.length}</span>
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
                      {displayName(
                        players.find((p) => toId(p?.id) === currentTurnId) ?? null,
                        "opponent"
                      )}
                    </span>{" "}
                    to play.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                <div className="relative p-8">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_55%)]" />
                  </div>
                  <div className="relative">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
                      <Crown className="h-4 w-4" />
                      MATCH COMPLETED
                    </div>

                    <h2 className="mt-5 text-3xl font-semibold text-white">GAME OVER</h2>
                    <p className="mt-2 text-sm text-zinc-300">
                      Winner:{" "}
                      <span className="font-semibold text-white">
                        {winnerLabel || "Unknown"}
                      </span>
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                        <p className="text-xs font-semibold tracking-wide text-zinc-400">YOU</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {displayName(me as Player | null, "Player")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                        <p className="text-xs font-semibold tracking-wide text-zinc-400">
                          FINAL SCORE (BO3)
                        </p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {leftOverall} - {rightOverall}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => router.replace("/lobby")}
                      className="mt-6 w-full rounded-3xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 px-6 py-4 text-base font-semibold text-black hover:brightness-110 transition"
                    >
                      Return to Lobby
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section
            className={`relative overflow-hidden rounded-3xl border bg-white/[0.06] p-6 backdrop-blur-xl transition ${
              gameState?.currentTurn === toId(rightPlayer?.id)
                ? "border-fuchsia-400/40 shadow-[0_0_0_1px_rgba(232,121,249,0.18),0_0_50px_rgba(232,121,249,0.10)]"
                : "border-white/10"
            }`}
          >
            <div className="absolute inset-0 pointer-events-none opacity-0 [mask-image:radial-gradient(circle_at_70%_20%,black,transparent_70%)] lg:opacity-100">
              <div className="absolute inset-0 bg-gradient-to-bl from-fuchsia-500/10 to-cyan-400/5" />
            </div>

            <div className="relative">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-zinc-400">PLAYER 2</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    {displayName(rightPlayer, "Waiting...")}
                    {toId(rightPlayer?.id) === userId && (
                      <span className="ml-2 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-200">
                        You
                      </span>
                    )}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-300">
                    Round points:{" "}
                    <span className="font-semibold text-white">{rightRoundScore}</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-center">
                  <p className="text-[10px] tracking-[0.22em] text-zinc-400">MATCH</p>
                  <p className="mt-0.5 text-lg font-semibold text-white">{rightOverall}</p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-wide text-zinc-400">STRIKES</p>
                <div className="mt-2 flex items-center gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <span
                      key={i}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border ${
                        i < rightStrikes
                          ? "border-red-500/30 bg-red-500/10 text-red-200"
                          : "border-white/10 bg-white/[0.04] text-zinc-500"
                      }`}
                    >
                      <X className="h-4 w-4" />
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
                <span className="text-zinc-400">Status:</span>{" "}
                <span className="font-semibold text-white">
                  {gameState?.currentTurn === toId(rightPlayer?.id) ? "Your side to play" : "Waiting"}
                </span>
              </div>
            </div>
          </section>
        </main>

        {!gameState && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-sm text-zinc-300">
            Loading game state… If this takes too long, make sure the socket is connected and the
            server is emitting `gameStateUpdated`.
          </div>
        )}
      </div>
    </div>
  );
}

