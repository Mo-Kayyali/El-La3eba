"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { X, Crown, Swords, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { refreshAuthProfile } from "@/lib/api";
import { useSocketStore } from "@/src/store/socketStore";
import { getRank } from "@/lib/rank";
import type { Socket } from "socket.io-client";

type Player = {
  id?: string | number;
  username?: string;
  email?: string;
  [key: string]: unknown;
};

/** A guess entry in the activity feed. Backend now sends objects with guessedBy. */
type GuessEntry = { name: string; guessedBy: string } | string;

type GameState = {
  players?: Array<string | number | Player>;
  currentTurn?: string | number | null;
  scores?: Record<string, number> | number[];
  strikes?: Record<string, number> | number[];
  guessedPlayers?: GuessEntry[];
  currentQuestion?: string;
  currentRound?: number;
  overallScores?: Record<string, number> | number[];
  status?: "in_progress" | "match_completed" | string;
  winner?: Player | string | number | null;
  playerNames?: Record<string, string>;
  playerMmr?: Record<string, number>;
  roundHistory?: Array<{
    round: number;
    winner: string | number;
    scores: Record<string, number>;
  }>;
  turnDeadlineAt?: number;
  isRanked?: boolean;
  [key: string]: unknown;
};

type LastGuess = {
  user: string;
  guess: string;
  correct: boolean;
  matchedName: string | null;
};

type FlashState = "correct" | "wrong" | null;

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

/** Extract display name and guessedBy from a GuessEntry (handles legacy string format) */
function parseGuessEntry(entry: GuessEntry): {
  name: string;
  guessedBy: string | null;
} {
  if (typeof entry === "string") return { name: entry, guessedBy: null };
  return { name: entry.name, guessedBy: entry.guessedBy };
}

function Logo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg
        width="22"
        height="22"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="15" stroke="url(#gp-grad)" strokeWidth="2" />
        <path
          d="M16 4 L20 10 L14 14 L10 9 Z"
          fill="url(#gp-grad)"
          opacity="0.9"
        />
        <path
          d="M22 8 L26 14 L22 20 L16 18 L14 14 L20 10 Z"
          fill="url(#gp-grad2)"
          opacity="0.7"
        />
        <path
          d="M10 22 L14 14 L16 18 L14 26 Z"
          fill="url(#gp-grad)"
          opacity="0.8"
        />
        <defs>
          <linearGradient
            id="gp-grad"
            x1="0"
            y1="0"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#3b82f6" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
          <linearGradient
            id="gp-grad2"
            x1="32"
            y1="0"
            x2="0"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#60a5fa" />
            <stop offset="1" stopColor="#818cf8" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-sm font-extrabold tracking-tight">
        <span className="text-white">El-</span>
        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          La3eba
        </span>
      </span>
    </div>
  );
}

function emitLeaveEndedMatch(
  socket: Socket | null,
  gameSessionId: string | undefined,
) {
  if (socket?.connected && gameSessionId) {
    socket.emit("leaveEndedMatch", { gameSessionId });
  }
}



export default function GamePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const { user, accessToken, isAuthenticated, bootstrapped } = useAuthStore();
  const { socket, isConnected, connectSocket } = useSocketStore();

  const gameSessionId = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.id]);

  const userId = toId(user?.id);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [guess, setGuess] = useState("");
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(10);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionSecondsLeft, setTransitionSecondsLeft] = useState<number>(0);
  const guessInputRef = useRef<HTMLInputElement | null>(null);

  // Flash animation state for each player card
  const [flashLeft, setFlashLeft] = useState<FlashState>(null);
  const [flashRight, setFlashRight] = useState<FlashState>(null);
  const flashLeftTimer = useRef<number | null>(null);
  const flashRightTimer = useRef<number | null>(null);

  // Non-blocking disconnect banner state
  const [disconnectedUserId, setDisconnectedUserId] = useState<string | null>(
    null,
  );
  const [disconnectSecondsLeft, setDisconnectSecondsLeft] = useState<
    number | null
  >(null);

  // Rematch state
  const [rematchSecondsLeft, setRematchSecondsLeft] = useState(30);
  const [hasRequestedRematch, setHasRequestedRematch] = useState(false);
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);

  /** Populated from `matchOver` payload (ranked). */
  const [mmrDeltas, setMmrDeltas] = useState<Record<string, number> | null>(
    null,
  );
  const [showForfeitModal, setShowForfeitModal] = useState(false);
  const [opponentLeftRematch, setOpponentLeftRematch] = useState(false);
  const [matchEndedByForfeit, setMatchEndedByForfeit] = useState(false);

  const triggerFlash = (side: "left" | "right", type: "correct" | "wrong") => {
    if (side === "left") {
      if (flashLeftTimer.current) window.clearTimeout(flashLeftTimer.current);
      setFlashLeft(type);
      flashLeftTimer.current = window.setTimeout(() => setFlashLeft(null), 700);
    } else {
      if (flashRightTimer.current) window.clearTimeout(flashRightTimer.current);
      setFlashRight(type);
      flashRightTimer.current = window.setTimeout(
        () => setFlashRight(null),
        700,
      );
    }
  };

  useEffect(() => {
    setMmrDeltas(null);
    setShowForfeitModal(false);
    setHasRequestedRematch(false);
    setOpponentWantsRematch(false);
    setOpponentLeftRematch(false);
    setMatchEndedByForfeit(false);
    setDisconnectedUserId(null);
    setDisconnectSecondsLeft(null);
  }, [gameSessionId]);

  useEffect(() => {
    return () => {
      if (flashLeftTimer.current) window.clearTimeout(flashLeftTimer.current);
      if (flashRightTimer.current) window.clearTimeout(flashRightTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!accessToken || !isAuthenticated) {
      router.replace("/");
      return;
    }
    connectSocket(accessToken);
  }, [bootstrapped, accessToken, connectSocket, isAuthenticated, router]);

  // Stable refs for player IDs (needed inside socket handlers without stale closures)
  const leftPlayerIdRef = useRef<string | number | undefined>(undefined);
  const rightPlayerIdRef = useRef<string | number | undefined>(undefined);

  useEffect(() => {
    if (!socket || !gameSessionId) return;
    if (!isConnected) return;

    socket.emit("joinGameRoom", { gameSessionId });

    const onGameStateUpdated = (payload: any) => {
      const actualState = payload?.state || payload;
      setGameState(actualState ?? null);

      const lastGuess = payload?.lastGuess as LastGuess | undefined;
      if (lastGuess) {
        const guesserId = String(lastGuess.user);
        const isLeft = guesserId === String(leftPlayerIdRef.current);
        const isRight = guesserId === String(rightPlayerIdRef.current);
        if (isLeft)
          triggerFlash("left", lastGuess.correct ? "correct" : "wrong");
        if (isRight)
          triggerFlash("right", lastGuess.correct ? "correct" : "wrong");
      }
    };

    const onNextRoundStarted = (payload: GameState) => {
      const actualState = (payload as any)?.state || payload;
      setGameState(actualState ?? null);
      setIsTransitioning(false);
      setTransitionSecondsLeft(0);
      const round = (actualState as any)?.currentRound;
      toast.success(
        `Round ${typeof round === "number" ? round : "?"} started!`,
      );
    };

    const onMatchOver = (payload: GameState) => {
      const actualState = (payload as any)?.state || payload;
      setGameState(actualState ?? null);
      setIsTransitioning(false);
      setTransitionSecondsLeft(0);
      setDisconnectedUserId(null);
      setDisconnectSecondsLeft(null);

      const rawForfeit = (payload as { forfeit?: boolean })?.forfeit === true;
      setMatchEndedByForfeit(rawForfeit);

      const rawDeltas = (payload as any)?.mmrDeltas as
        | Record<string, number>
        | undefined;
      setMmrDeltas(rawDeltas ?? null);

      if (rawDeltas && userId !== undefined) {
        const mine = rawDeltas[String(userId)];
        if (typeof mine === "number")
          useAuthStore.getState().applyMmrDelta(mine);
      }

      const disconnectedUserId = (payload as any)?.disconnectedUserId;
      if (
        disconnectedUserId &&
        userId !== undefined &&
        String(disconnectedUserId) !== String(userId)
      ) {
        setOpponentLeftRematch(true);
      }

      // Flash on last guess before match over
      const lastGuess = (payload as any)?.lastGuess as LastGuess | undefined;
      if (lastGuess) {
        const guesserId = String(lastGuess.user);
        const isLeft = guesserId === String(leftPlayerIdRef.current);
        const isRight = guesserId === String(rightPlayerIdRef.current);
        if (isLeft)
          triggerFlash("left", lastGuess.correct ? "correct" : "wrong");
        if (isRight)
          triggerFlash("right", lastGuess.correct ? "correct" : "wrong");
      }
      toast.message("Match over");

      const forfeitedBy = (payload as { forfeitedByUserId?: string })
        ?.forfeitedByUserId;
      if (
        forfeitedBy &&
        userId !== undefined &&
        String(forfeitedBy) === String(userId)
      ) {
        setShowForfeitModal(false);
      }
    };

    const onRoundOver = (payload: any) => {
      const nextRoundIn =
        typeof payload?.nextRoundIn === "number" ? payload.nextRoundIn : 4;
      setIsTransitioning(true);
      setTransitionSecondsLeft(Math.max(0, Math.floor(nextRoundIn)));
      const winner = payload?.winner;
      toast.message(
        `Round over${winner ? ` • Winner: ${String(winner)}` : ""} — next round soon`,
      );
    };

    const onRematchRequested = (payload: { userId: string }) => {
      if (String(payload?.userId) !== String(userId)) {
        setOpponentWantsRematch(true);
      }
    };

    const onRematchStarting = (payload: { newGameSessionId: string }) => {
      if (payload?.newGameSessionId) {
        router.push(`/game/${payload.newGameSessionId}`);
      }
    };

    const onRematchExpired = () => {
      emitLeaveEndedMatch(socket, gameSessionId);
      void refreshAuthProfile();
      router.push("/lobby");
    };

    const onOpponentLeft = (payload: {
      gameSessionId?: string;
      userId?: string;
    }) => {
      if (payload?.gameSessionId && payload.gameSessionId !== gameSessionId)
        return;
      const leftId = payload?.userId ? String(payload.userId) : "";
      if (!leftId) return;
      if (userId !== undefined && leftId === String(userId)) return;
      setOpponentLeftRematch(true);
      setOpponentWantsRematch(false);
    };

    const onPlayerDisconnected = (payload: {
      userId: string;
      gameSessionId?: string;
    }) => {
      if (payload?.gameSessionId && payload.gameSessionId !== gameSessionId)
        return;
      const dropped = payload?.userId ? String(payload.userId) : "";
      if (!dropped) return;
      if (userId !== undefined && dropped === String(userId)) return;
      setDisconnectedUserId(dropped);
      setDisconnectSecondsLeft(30);
    };

    const onPlayerReconnected = (payload: {
      userId: string;
      gameSessionId?: string;
    }) => {
      if (payload?.gameSessionId && payload.gameSessionId !== gameSessionId)
        return;
      const uid = payload?.userId ? String(payload.userId) : "";
      setDisconnectedUserId((prev) => {
        if (!uid || uid !== prev) return prev;
        setDisconnectSecondsLeft(null);
        return null;
      });
    };

    socket.on("gameStateUpdated", onGameStateUpdated);
    socket.on("nextRoundStarted", onNextRoundStarted);
    socket.on("matchOver", onMatchOver);
    socket.on("roundOver", onRoundOver);
    socket.on("rematchRequested", onRematchRequested);
    socket.on("rematchStarting", onRematchStarting);
    socket.on("rematchExpired", onRematchExpired);
    socket.on("opponentLeft", onOpponentLeft);
    socket.on("playerDisconnected", onPlayerDisconnected);
    socket.on("playerReconnected", onPlayerReconnected);

    return () => {
      socket.off("gameStateUpdated", onGameStateUpdated);
      socket.off("nextRoundStarted", onNextRoundStarted);
      socket.off("matchOver", onMatchOver);
      socket.off("roundOver", onRoundOver);
      socket.off("rematchRequested", onRematchRequested);
      socket.off("rematchStarting", onRematchStarting);
      socket.off("rematchExpired", onRematchExpired);
      socket.off("opponentLeft", onOpponentLeft);
      socket.off("playerDisconnected", onPlayerDisconnected);
      socket.off("playerReconnected", onPlayerReconnected);
    };
  }, [gameSessionId, isConnected, router, socket, userId]);

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
    return [player1Id, player2Id] as const;
  }, [player1Id, player2Id, userId]);

  // Keep refs in sync so socket handlers can access current values without stale closure
  useEffect(() => {
    leftPlayerIdRef.current = leftPlayerId;
    rightPlayerIdRef.current = rightPlayerId;
  }, [leftPlayerId, rightPlayerId]);

  const leftId = coerceString(leftPlayerId);
  const rightId = coerceString(rightPlayerId);

  const currentTurnId = gameState?.currentTurn;
  const isMyTurn = userId !== undefined && currentTurnId === userId;
  const isMatchOver = gameState?.status === "match_completed";

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
    const byRound = new Map<
      number,
      NonNullable<GameState["roundHistory"]>[number]
    >();
    for (const h of history) {
      if (!h || typeof h.round !== "number") continue;
      byRound.set(h.round, h);
    }

    if (isMatchOver) {
      const r =
        typeof gameState?.currentRound === "number"
          ? gameState.currentRound
          : undefined;
      const strikes = gameState?.strikes;
      const scores = gameState?.scores;
      const hasRound = r !== undefined && byRound.has(r);
      const canInfer =
        r !== undefined &&
        !hasRound &&
        strikes !== undefined &&
        scores !== undefined;

      if (canInfer) {
        const p1Key = coerceString(player1Id);
        const p2Key = coerceString(player2Id);
        const p1Strikes = getByKeyOrIndex(strikes as any, p1Key, 0);
        const p2Strikes = getByKeyOrIndex(strikes as any, p2Key, 1);
        const roundWinner =
          p1Strikes >= 3
            ? p2Key
            : p2Strikes >= 3
              ? p1Key
              : coerceString(winnerId);

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

  // Visual turn countdown
  useEffect(() => {
    let remaining = 10;
    if (gameState?.turnDeadlineAt) {
      remaining = Math.max(0, Math.ceil((gameState.turnDeadlineAt - Date.now()) / 1000));
    }
    setTurnSecondsLeft(remaining);
    if (isMatchOver) return;
    if (gameState?.currentTurn === null || gameState?.currentTurn === undefined)
      return;

    const id = window.setInterval(() => {
      setTurnSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameState?.currentTurn, gameState?.turnDeadlineAt, isMatchOver]);

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

  useEffect(() => {
    if (!disconnectedUserId || isMatchOver) return;

    const id = window.setInterval(() => {
      setDisconnectSecondsLeft((current) => {
        if (typeof current !== "number") return 0;
        return Math.max(0, current - 1);
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [disconnectedUserId, isMatchOver]);

  // 30-second rematch countdown
  useEffect(() => {
    if (!isMatchOver) return;
    setRematchSecondsLeft(30);
    const id = window.setInterval(() => {
      setRematchSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isMatchOver]);

  const currentRound = gameState?.currentRound ?? 1;
  const question = gameState?.currentQuestion ?? "Waiting for question...";
  const guessedPlayers = (gameState?.guessedPlayers ?? []) as GuessEntry[];

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
    return `0:${String(s).padStart(2, "0")}`;
  }, [turnSecondsLeft]);

  // ── Subcomponents ────────────────────────────────────────────────────────

  function PlayerCard({
    playerId,
    isLeft,
    isActive,
    isMe,
    roundScore,
    overallScore,
    strikes,
    flash,
    mmr,
  }: {
    playerId: string | number | undefined;
    isLeft: boolean;
    isActive: boolean;
    isMe: boolean;
    roundScore: number;
    overallScore: number;
    strikes: number;
    flash: FlashState;
    mmr?: number;
  }) {
    const flashClass =
      flash === "correct"
        ? "flash-green"
        : flash === "wrong"
          ? "flash-red"
          : "";

    return (
      <section
        className={[
          "relative overflow-hidden rounded-3xl border bg-white/[0.04] p-6 backdrop-blur-xl transition-all duration-300",
          flashClass,
          !isMatchOver && isActive
            ? "border-blue-400/40 shadow-[0_0_20px_rgba(59,130,246,0.25)]"
            : "border-white/[0.07]",
          isMatchOver
            ? "opacity-30 pointer-events-none"
            : !isActive && (gameState?.currentTurn ?? null) !== null
              ? "opacity-50"
              : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Subtle corner gradient */}
        <div
          className={`absolute inset-0 pointer-events-none opacity-0 lg:opacity-100 ${
            isLeft
              ? "[mask-image:radial-gradient(circle_at_25%_20%,black,transparent_65%)]"
              : "[mask-image:radial-gradient(circle_at_75%_20%,black,transparent_65%)]"
          }`}
        >
          <div
            className={`absolute inset-0 ${
              isLeft
                ? "bg-gradient-to-br from-blue-500/8 to-transparent"
                : "bg-gradient-to-bl from-violet-500/8 to-transparent"
            }`}
          />
        </div>

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
                {isMe ? "YOU" : "OPPONENT"}
              </p>
              <h2 className="mt-1 text-lg font-bold text-white">
                {displayName(playerId, "Waiting…")}
              </h2>
              {mmr !== undefined && (
                <p className="mt-1 text-xs text-slate-400">
                  MMR:{" "}
                  <span className="font-bold tabular-nums text-slate-100">
                    {mmr}
                  </span>
                </p>
              )}
              {/* MMR rank badge */}
              {mmr !== undefined &&
                (() => {
                  const r = getRank(mmr);
                  return (
                    <div
                      className={`mt-1 inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 ${r.borderClass} ${r.glowClass}`}
                    >
                      <span
                        className={`text-[10px] font-extrabold tracking-wide ${r.colorClass}`}
                      >
                        {r.name.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-slate-500 tabular-nums">
                        {mmr}
                      </span>
                    </div>
                  );
                })()}
              <p className="mt-1 text-sm text-slate-400">
                Round pts:{" "}
                <span className="font-bold text-white">{roundScore}</span>
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-black/30 px-3 py-2 text-center shrink-0">
              <p className="text-[9px] tracking-[0.25em] text-slate-500">
                MATCH
              </p>
              <p className="mt-0.5 text-xl font-extrabold text-white">
                {overallScore}
              </p>
            </div>
          </div>

          {/* Strikes */}
          <div className="mt-5">
            <p className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
              STRIKES
            </p>
            <div className="mt-2 flex items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <span
                  key={i}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl border transition-all ${
                    i < strikes
                      ? "border-red-500/60 bg-red-500/20 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                      : "border-white/[0.07] bg-white/[0.03] text-slate-600"
                  }`}
                >
                  <X
                    className="h-4 w-4"
                    strokeWidth={2.5}
                    fill={i < strikes ? "currentColor" : "none"}
                  />
                </span>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-sm">
            <span className="text-slate-500">Status: </span>
            <span
              className={`font-semibold ${
                isActive ? "text-blue-300 animate-pulse" : "text-slate-300"
              }`}
            >
              {isActive
                ? isMe
                  ? "Your Turn"
                  : "Opponent's Turn"
                : isMe
                  ? "Waiting…"
                  : "Waiting…"}
            </span>
          </div>
        </div>
      </section>
    );
  }

  function GameOverScreen() {
    const isRanked = gameState?.isRanked === true;
    const myMmrDelta =
      userId !== undefined && mmrDeltas ? mmrDeltas[String(userId)] : undefined;
    const iWon =
      userId !== undefined &&
      winnerId !== undefined &&
      String(winnerId) === String(userId);

    return (
      <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100 flex flex-col items-center justify-center px-6 py-12">
        {/* Background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(29,78,216,0.15),transparent_65%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_80%_80%,rgba(109,40,217,0.1),transparent_55%)]" />
        </div>

        <div className="relative w-full max-w-3xl">
          {/* Result header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/8 px-4 py-2 mb-4">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">
                Match Complete
              </span>
            </div>
            <h2 className="text-5xl font-extrabold tracking-tight text-white">
              {winnerLabel || "Winner"}
            </h2>
            {userId !== undefined && winnerId !== undefined && (
              <p
                className={`mt-3 text-lg font-bold ${
                  iWon ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {iWon ? "You won" : matchEndedByForfeit ? "You forfeited" : "You lost"}
              </p>
            )}
            {isRanked && typeof myMmrDelta === "number" && (
              <p
                className={`mt-2 text-3xl font-extrabold tabular-nums ${
                  myMmrDelta >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {myMmrDelta > 0 ? `+${myMmrDelta}` : myMmrDelta} MMR
              </p>
            )}
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-slate-300">
              <Crown className="h-4 w-4 text-amber-300" />
              <span className="font-semibold text-white">Best of 3</span>
              <span className="text-slate-500">•</span>
              <span className="font-bold text-white">
                {leftOverall} – {rightOverall}
              </span>
            </div>
          </div>

          {/* Round history cards */}
          <div className="flex gap-4 overflow-x-auto pb-2 px-1">
            {normalizedRoundHistory.map(({ round, entry }) => {
              const w = entry?.winner;
              const winnerName =
                w !== undefined && w !== null
                  ? (playerNames[coerceString(w)] ?? String(w))
                  : "—";
              const leftPts = entry?.scores ? (entry.scores[leftId] ?? 0) : 0;
              const rightPts = entry?.scores ? (entry.scores[rightId] ?? 0) : 0;

              return (
                <div
                  key={round}
                  className="min-w-[200px] flex-1 rounded-3xl border border-white/[0.07] bg-white/[0.04] p-5"
                >
                  <p className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
                    ROUND {round}
                  </p>
                  <p className="mt-3 text-4xl font-extrabold text-white">
                    {leftPts} <span className="text-slate-600">–</span>{" "}
                    {rightPts}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Winner:{" "}
                    <span className="font-semibold text-white">
                      {winnerName}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>

          {/* Rematch panel */}
          <div className="mt-6 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6">
            <div className="flex items-center justify-center gap-3 mb-5">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-xl font-extrabold ${
                    rematchSecondsLeft <= 5
                      ? "border-red-500/60 text-red-300"
                      : rematchSecondsLeft <= 10
                        ? "border-amber-400/60 text-amber-200"
                        : "border-white/20 text-white"
                  }`}
                >
                  {rematchSecondsLeft}
                </div>
                <p className="text-sm text-slate-400">seconds to decide</p>
              </div>

            {opponentWantsRematch &&
              !hasRequestedRematch &&
              !opponentLeftRematch && (
                <div className="mb-4 flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-2 text-sm font-semibold text-emerald-300">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    Opponent wants to play again!
                  </div>
                </div>
              )}

            {opponentLeftRematch && (
              <div className="mb-4 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200">
                  Opponent Left
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  disabled={
                    hasRequestedRematch ||
                    rematchSecondsLeft === 0 ||
                    opponentLeftRematch
                  }
                  onClick={() => {
                    if (
                      !socket?.connected ||
                      !gameSessionId ||
                      hasRequestedRematch ||
                      opponentLeftRematch
                    )
                      return;
                    setHasRequestedRematch(true);
                    socket.emit("requestRematch", { gameSessionId });
                  }}
                  className={`flex-1 rounded-3xl px-6 py-4 text-sm font-bold transition sm:max-w-[240px] ${
                    hasRequestedRematch ||
                    rematchSecondsLeft === 0 ||
                    opponentLeftRematch
                      ? "cursor-not-allowed bg-white/[0.06] text-slate-400"
                      : "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:brightness-110"
                  }`}
                >
                  {opponentLeftRematch ? (
                    "Opponent Left"
                  ) : hasRequestedRematch ? (
                    <span className="inline-flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-300" />
                      Waiting…
                    </span>
                  ) : (
                    "Play Again"
                  )}
                </button>

              <button
                onClick={() => {
                  emitLeaveEndedMatch(socket, gameSessionId);
                  void refreshAuthProfile();
                  router.replace("/lobby");
                }}
                className="flex-1 rounded-3xl border border-white/[0.08] bg-white/[0.04] px-6 py-4 text-sm font-bold text-white hover:bg-white/[0.07] transition sm:max-w-[240px]"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
          <p className="text-sm text-slate-400">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (gameState?.status === "match_completed") {
    return <GameOverScreen />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(29,78,216,0.14),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_35%_at_90%_110%,rgba(109,40,217,0.1),transparent_55%)]" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-5 py-6">
        {/* ── Header ── */}
        <header className="flex items-center justify-between pb-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-5">
            <Logo />
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">
                <Swords className="h-3.5 w-3.5 text-blue-400" />
                BO3 · {leftOverall} – {rightOverall}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300">
                Round{" "}
                <span className="ml-1.5 font-extrabold text-white">
                  {currentRound}
                </span>
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  socket?.connected
                    ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-300"
                    : "border-white/[0.08] bg-white/[0.04] text-slate-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${socket?.connected ? "bg-emerald-400" : "bg-zinc-500"}`}
                />
                {socket?.connected ? "Live" : "Connecting…"}
              </span>
            </div>
          </div>
        </header>

        {showForfeitModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="forfeit-title"
              className="w-full max-w-md rounded-3xl border border-red-500/25 bg-[#030712] p-8 shadow-[0_0_60px_rgba(239,68,68,0.12)]"
            >
              <h3
                id="forfeit-title"
                className="text-lg font-extrabold text-white"
              >
                Forfeit this match?
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Are you sure? This counts as a loss and will drop your MMR in
                ranked games.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForfeitModal(false)}
                  className="rounded-2xl border border-white/[0.1] bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!socket?.connected || !gameSessionId) return;
                    socket.emit(
                      "forfeitMatch",
                      { gameSessionId },
                      (res: { status?: string; message?: string }) => {
                        if (res?.status === "ok") {
                          setShowForfeitModal(false);
                        } else {
                          toast.error(res?.message ?? "Could not forfeit.");
                        }
                      },
                    );
                  }}
                  className="rounded-2xl bg-gradient-to-r from-red-600 to-red-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(239,68,68,0.25)] hover:brightness-110 transition"
                >
                  Yes, forfeit
                </button>
              </div>
            </div>
          </div>
        )}

        {disconnectedUserId && !isMatchOver && (
          <div className="mt-5 flex justify-center">
            <div className="w-full max-w-3xl rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-center shadow-[0_0_24px_rgba(251,191,36,0.14)]">
              <p className="text-sm font-semibold text-amber-100">
                {playerNames[disconnectedUserId] ?? "Opponent"} disconnected.
                Match will forfeit in{" "}
                <span className="tabular-nums text-amber-300">
                  {typeof disconnectSecondsLeft === "number"
                    ? `${disconnectSecondsLeft}s`
                    : "30s"}
                </span>{" "}
                unless they reconnect.
              </p>
            </div>
          </div>
        )}

        {/* ── Main 3-column grid ── */}
        <main className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.3fr_1fr]">
          {/* Left player card */}
          <PlayerCard
            playerId={leftPlayerId}
            isLeft
            isActive={leftIsActive}
            isMe={leftIsMe}
            roundScore={leftRoundScore}
            overallScore={leftOverall}
            strikes={leftStrikes}
            flash={flashLeft}
            mmr={
              leftId
                ? (
                    gameState?.playerMmr as Record<string, number> | undefined
                  )?.[leftId]
                : undefined
            }
          />

          {/* Centre: question + guess input + activity feed */}
          {isMatchOver ? (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 opacity-30 pointer-events-none" />
          ) : (
            <section className="rounded-3xl border border-white/[0.07] bg-white/[0.04] p-6 backdrop-blur-xl">
              {/* Question */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
                    QUESTION
                  </p>
                  <h3 className="mt-2 text-lg font-bold text-white leading-snug">
                    {question}
                  </h3>
                </div>
                <div
                  className={`shrink-0 rounded-2xl border px-3 py-1.5 text-xs font-bold ${
                    isMyTurn && !isTransitioning
                      ? "border-blue-500/30 bg-blue-500/8 text-blue-200"
                      : "border-white/[0.07] bg-white/[0.03] text-slate-400"
                  }`}
                >
                  {isTransitioning
                    ? "Transition"
                    : isMyTurn
                      ? "Your turn"
                      : "Waiting"}
                </div>
              </div>

              {/* Timer */}
              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-black/30 px-4 py-3">
                <p className="text-[10px] font-bold tracking-[0.25em] text-slate-500">
                  {isTransitioning ? "NEXT ROUND" : "TURN TIMER"}
                </p>
                <div className="flex items-center gap-2">
                  {/* Timer arc visualization */}
                  {!isTransitioning && (
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      className="-rotate-90"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="2"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke={turnSecondsLeft <= 3 ? "#ef4444" : "#3b82f6"}
                        strokeWidth="2"
                        strokeDasharray={`${2 * Math.PI * 10}`}
                        strokeDashoffset={`${2 * Math.PI * 10 * (1 - turnSecondsLeft / 10)}`}
                        strokeLinecap="round"
                        style={{
                          transition:
                            "stroke-dashoffset 1s linear, stroke 0.3s",
                        }}
                      />
                    </svg>
                  )}
                  <p
                    className={`text-lg font-extrabold tabular-nums ${
                      !isTransitioning && turnSecondsLeft <= 3
                        ? "text-red-400"
                        : "text-white"
                    }`}
                  >
                    {isTransitioning
                      ? transitionSecondsLeft > 0
                        ? `${transitionSecondsLeft}s`
                        : "Starting…"
                      : timerLabel}
                  </p>
                </div>
              </div>

              {/* Input or transition */}
              <div className="mt-5">
                {isTransitioning ? (
                  <div className="rounded-3xl border border-white/[0.07] bg-black/20 p-5 text-center">
                    <p className="text-sm font-semibold text-white">
                      Round Over! Next round starting…
                    </p>
                    <p className="mt-1 text-2xl font-extrabold text-blue-300">
                      {transitionSecondsLeft > 0
                        ? `${transitionSecondsLeft}s`
                        : "Starting…"}
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="mb-1.5 text-[10px] font-bold tracking-[0.25em] text-slate-500">
                        YOUR GUESS
                      </p>
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
                            ? "Type a player name…"
                            : "Waiting for your turn…"
                        }
                        className="w-full rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 focus:ring-4 focus:ring-blue-500/8 disabled:cursor-not-allowed disabled:opacity-50 transition"
                      />
                    </div>
                    <button
                      disabled={!canSubmit || !guess.trim()}
                      onClick={submitGuess}
                      className={`self-end rounded-2xl px-5 py-3 text-sm font-bold transition ${
                        !canSubmit || !guess.trim()
                          ? "cursor-not-allowed bg-white/[0.06] text-slate-500"
                          : "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)] hover:brightness-110"
                      }`}
                    >
                      Submit
                    </button>
                  </div>
                )}

                {/* Activity feed */}
                <div className="mt-5 rounded-3xl border border-white/[0.07] bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-xs font-bold text-white">
                      Activity Feed
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500">
                      {guessedPlayers.length} named
                    </span>
                  </div>

                  {guessedPlayers.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No guesses yet. Be the first to name a player.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {guessedPlayers.map((entry, idx) => {
                        const { name, guessedBy } = parseGuessEntry(entry);
                        const isMine =
                          guessedBy !== null &&
                          String(guessedBy) === String(userId);
                        const isOpponent =
                          guessedBy !== null &&
                          String(guessedBy) !== String(userId);

                        return (
                          <span
                            key={`${name}-${idx}`}
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              isMine
                                ? "border-blue-500/30 bg-blue-600/20 text-blue-100"
                                : isOpponent
                                  ? "border-red-500/30 bg-red-600/20 text-red-100"
                                  : "border-white/[0.08] bg-white/[0.05] text-slate-300"
                            }`}
                          >
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Waiting banner */}
                {!isMyTurn && !isTransitioning && (
                  <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                    Waiting for{" "}
                    <span className="font-semibold text-white">
                      {currentTurnName || "opponent"}
                    </span>{" "}
                    to play…
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Right player card */}
          <PlayerCard
            playerId={rightPlayerId}
            isLeft={false}
            isActive={rightIsActive}
            isMe={rightIsMe}
            roundScore={rightRoundScore}
            overallScore={rightOverall}
            strikes={rightStrikes}
            flash={flashRight}
            mmr={
              rightId
                ? (
                    gameState?.playerMmr as Record<string, number> | undefined
                  )?.[rightId]
                : undefined
            }
          />
        </main>

        <div className="mt-5 flex justify-start">
          <button
            type="button"
            onClick={() => setShowForfeitModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 transition"
          >
            Forfeit Match
          </button>
        </div>

        {/* No game state yet */}
        {!gameState && (
          <div className="mt-8 rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 text-sm text-slate-400 text-center">
            Connecting to game… If this takes too long, ensure the server is
            running.
          </div>
        )}
      </div>
    </div>
  );
}
