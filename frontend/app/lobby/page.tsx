"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Swords, Users, User, LogOut, Crown, Star } from "lucide-react";
import { api, refreshAuthProfile } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useSocketStore } from "@/src/store/socketStore";
import { getRank } from "@/lib/rank";
import { RankTierLegend } from "@/components/rank-tier-legend";

interface LeaderboardEntry {
  id: string;
  username: string;
  mmr: number;
  wins: number;
  gamesPlayed: number;
}

function Logo() {
  return (
    <div className="flex items-center gap-2 select-none">
      <svg
        width="26"
        height="26"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="15" stroke="url(#lb-grad)" strokeWidth="2" />
        <path
          d="M16 4 L20 10 L14 14 L10 9 Z"
          fill="url(#lb-grad)"
          opacity="0.9"
        />
        <path
          d="M22 8 L26 14 L22 20 L16 18 L14 14 L20 10 Z"
          fill="url(#lb-grad2)"
          opacity="0.7"
        />
        <path
          d="M10 22 L14 14 L16 18 L14 26 Z"
          fill="url(#lb-grad)"
          opacity="0.8"
        />
        <defs>
          <linearGradient
            id="lb-grad"
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
            id="lb-grad2"
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
      <span className="text-lg font-extrabold tracking-tight">
        <span className="text-white">El-</span>
        <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          La3eba
        </span>
      </span>
    </div>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, logout, bootstrapped } =
    useAuthStore();
  const { socket, connectSocket, disconnectSocket } = useSocketStore();

  const username = useMemo(
    () => user?.username ?? user?.email ?? "Player",
    [user?.username, user?.email],
  );

  // Match-finding state
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState<"ranked" | "unrated" | null>(
    null,
  );

  // Private match — create flow
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [isWaitingForFriend, setIsWaitingForFriend] = useState(false);

  // Private match — join flow
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!accessToken) {
      router.replace("/");
      return;
    }
    connectSocket(accessToken);
    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapped, accessToken, router]);

  useEffect(() => {
    if (!bootstrapped || !accessToken) return;
    void refreshAuthProfile();
  }, [bootstrapped, accessToken]);

  useEffect(() => {
    api
      .get<LeaderboardEntry[]>("/game/leaderboard")
      .then((res) => setLeaderboard(res.data ?? []))
      .catch(() => setLeaderboard([]))
      .finally(() => setLeaderboardLoading(false));
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onMatchFound = (payload: { gameSessionId?: string }) => {
      const gameSessionId = payload?.gameSessionId;
      if (!gameSessionId) return;
      router.replace(`/game/${gameSessionId}`);
    };

    const onConnectError = (err: unknown) => {
      const message =
        typeof err === "object" && err && "message" in err
          ? String((err as { message: unknown }).message)
          : "Could not connect.";

      setIsSearching(false);
      setSearchMode(null);

      if (/token|jwt|unauthorized|auth/i.test(message)) {
        disconnectSocket();
        logout();
        router.replace("/");
      }
    };

    socket.on("matchFound", onMatchFound);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("matchFound", onMatchFound);
      socket.off("connect_error", onConnectError);
    };
  }, [disconnectSocket, logout, router, socket]);

  function startSearch(mode: "ranked" | "unrated") {
    if (!socket?.connected || isSearching) return;
    setIsSearching(true);
    setSearchMode(mode);
    socket.emit("joinQueue", { mode });
  }

  function cancelSearch() {
    if (!socket?.connected) return;
    socket.emit("cancelSearch");
    setIsSearching(false);
    setSearchMode(null);
  }

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center px-6">
        <div className="flex flex-col items-center gap-3">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
          <p className="text-sm text-slate-400">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center backdrop-blur-xl">
          <Logo />
          <p className="mt-4 text-sm text-slate-400">
            You need to log in first.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-3 text-sm font-bold text-white hover:brightness-110 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_60%_at_50%_-5%,rgba(29,78,216,0.15),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_90%_100%,rgba(109,40,217,0.1),transparent_55%)]" />
        <div className="absolute -top-24 left-[-5%] h-[600px] w-[280px] rotate-[15deg] bg-gradient-to-b from-blue-600/8 to-transparent blur-3xl" />
        <div className="absolute -top-24 right-[-5%] h-[600px] w-[280px] rotate-[-15deg] bg-gradient-to-b from-violet-600/8 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-5 py-8">
        {/* ── Navbar ── */}
        <header className="flex items-center justify-between pb-8 border-b border-white/[0.06]">
          <Logo />

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
              <span
                className={`h-2 w-2 rounded-full ${socket?.connected ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" : "bg-zinc-500"}`}
              />
              <span className="text-xs font-medium text-slate-300">
                {socket?.connected ? "Online" : "Connecting…"}
              </span>
            </div>
            {/* User chip with rank badge */}
            {(() => {
              const myMmr =
                typeof user?.mmr === "number" ? user.mmr : undefined;
              const rank = myMmr !== undefined ? getRank(myMmr) : null;
              return (
                <div
                  className={`flex items-center gap-1.5 rounded-full border bg-white/[0.04] px-3 py-1.5 ${rank ? rank.borderClass : "border-white/[0.08]"}`}
                >
                  {rank ? (
                    <span
                      className={`text-[10px] font-extrabold tracking-wide ${rank.colorClass} ${rank.glowClass}`}
                    >
                      {rank.name.toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold tracking-wide text-slate-500">
                      —
                    </span>
                  )}
                  <span className="text-xs font-semibold text-slate-300">
                    {username}
                  </span>
                </div>
              );
            })()}
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/[0.08] transition"
            >
              <User className="h-3.5 w-3.5" />
              Profile
            </Link>
            <button
              onClick={() => {
                disconnectSocket();
                logout();
                router.replace("/");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.08] transition"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* ── Main content ── */}
        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_320px]">
          {/* Left: Match modes */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">
                Find a Match
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Choose your game mode and jump into the arena.
              </p>
            </div>

            {/* Searching banner */}
            {isSearching && (
              <div className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/8 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
                  <span className="text-sm font-semibold text-blue-200">
                    Searching for a{" "}
                    <span className="text-white capitalize">{searchMode}</span>{" "}
                    opponent…
                  </span>
                </div>
                <button
                  onClick={cancelSearch}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.1] transition"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Mode cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Ranked */}
              <ModeCard
                icon={<Swords className="h-6 w-6" />}
                title="Ranked Match"
                description="Climb the global Elo ladder. Wins and losses count."
                accentFrom="from-blue-600"
                accentTo="to-blue-400"
                glowColor="rgba(59,130,246,0.35)"
                disabled={isSearching || !socket?.connected}
                active={isSearching && searchMode === "ranked"}
                onClick={() => startSearch("ranked")}
                footer={
                  typeof user?.mmr === "number" ? (
                    <span className="mt-3 inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-bold tracking-wide text-blue-200">
                      Current MMR:{" "}
                      <span className="ml-1.5 tabular-nums text-white">
                        {user.mmr}
                      </span>
                    </span>
                  ) : null
                }
              />

              {/* Unrated */}
              <ModeCard
                icon={<Star className="h-6 w-6" />}
                title="Unrated Match"
                description="Practice freely. No MMR at stake, just bragging rights."
                accentFrom="from-violet-600"
                accentTo="to-violet-400"
                glowColor="rgba(139,92,246,0.35)"
                disabled={isSearching || !socket?.connected}
                active={isSearching && searchMode === "unrated"}
                onClick={() => startSearch("unrated")}
              />
            </div>

            {/* Private room panel */}
            {!isSearching && (
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-6 backdrop-blur-xl space-y-5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-white">
                    Private Room
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Create */}
                  <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-4 space-y-3">
                    <p className="text-xs font-semibold tracking-wide text-slate-400">
                      CREATE A ROOM
                    </p>
                    {!isWaitingForFriend ? (
                      <button
                        disabled={isCreatingRoom || !socket?.connected}
                        onClick={() => {
                          if (!socket?.connected) return;
                          setIsCreatingRoom(true);
                          setCreatedRoomCode(null);
                          socket.emit(
                            "createPrivateMatch",
                            (response: {
                              status: string;
                              roomCode?: string;
                            }) => {
                              setIsCreatingRoom(false);
                              if (
                                response?.status === "success" &&
                                response.roomCode
                              ) {
                                setCreatedRoomCode(response.roomCode);
                                setIsWaitingForFriend(true);
                              }
                            },
                          );
                        }}
                        className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.06] py-2.5 text-sm font-semibold text-white hover:bg-white/[0.1] transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isCreatingRoom ? "Creating…" : "Create Room"}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/8 p-3 text-center">
                          <p className="text-[10px] font-bold tracking-[0.3em] text-blue-300">
                            YOUR CODE
                          </p>
                          <p className="mt-1 text-3xl font-extrabold tracking-[0.3em] text-white">
                            {createdRoomCode}
                          </p>
                          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
                            Waiting for friend…
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(
                                createdRoomCode ?? "",
                              )
                            }
                            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.06] py-2 text-xs font-semibold text-white hover:bg-white/[0.1] transition"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              setIsWaitingForFriend(false);
                              setCreatedRoomCode(null);
                            }}
                            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2 text-xs font-semibold text-slate-400 hover:bg-white/[0.08] transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Join */}
                  <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-4 space-y-3">
                    <p className="text-xs font-semibold tracking-wide text-slate-400">
                      JOIN WITH CODE
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={roomCode}
                        onChange={(e) => {
                          setRoomCode(e.target.value.toUpperCase().slice(0, 6));
                          setJoinError(null);
                        }}
                        placeholder="A1B2C3"
                        maxLength={6}
                        className="flex-1 min-w-0 rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                      />
                      <button
                        disabled={
                          isJoining ||
                          !socket?.connected ||
                          roomCode.trim().length < 6
                        }
                        onClick={() => {
                          const code = roomCode.trim();
                          if (!code || !socket?.connected) return;
                          setIsJoining(true);
                          setJoinError(null);
                          socket.emit(
                            "joinPrivateMatch",
                            { roomCode: code },
                            (response: {
                              success?: boolean;
                              error?: string;
                              status?: string;
                            }) => {
                              setIsJoining(false);
                              if (
                                response?.success === false ||
                                response?.status === "error"
                              ) {
                                setJoinError(
                                  response?.error ?? "Failed to join room.",
                                );
                              }
                            },
                          );
                        }}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.12] transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isJoining ? "…" : "Join"}
                      </button>
                    </div>
                    {joinError && (
                      <p className="text-xs font-semibold text-red-400">
                        {joinError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Leaderboard */}
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-5 backdrop-blur-xl h-fit">
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="h-4 w-4 text-amber-400" />
              <span className="text-sm font-bold text-white">Top 10</span>
              <span className="ml-auto text-[10px] font-semibold tracking-wide text-slate-500">
                LEADERBOARD
              </span>
            </div>

            {leaderboardLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 rounded-xl bg-white/[0.04] animate-pulse"
                  />
                ))}
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No data yet.
              </p>
            ) : (
              <div className="space-y-1">
                {leaderboard.map((entry, i) => {
                  const isMe = String(entry.id) === String(user?.id);
                  const leaderPos = i + 1;
                  const mmrRank = getRank(entry.mmr);
                  return (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
                        isMe
                          ? `border ${mmrRank.borderClass} bg-blue-500/8`
                          : leaderPos <= 3
                            ? "bg-white/[0.04]"
                            : "hover:bg-white/[0.03]"
                      }`}
                    >
                      {/* Leaderboard position badge */}
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                          leaderPos === 1
                            ? "bg-amber-400/20 text-amber-300"
                            : leaderPos === 2
                              ? "bg-slate-400/20 text-slate-300"
                              : leaderPos === 3
                                ? "bg-orange-600/20 text-orange-300"
                                : "bg-white/[0.04] text-slate-500"
                        }`}
                      >
                        {leaderPos === 1 ? (
                          <Crown className="h-3.5 w-3.5" />
                        ) : (
                          leaderPos
                        )}
                      </div>

                      {/* Name + MMR rank */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p
                            className={`text-sm font-semibold truncate ${isMe ? "text-blue-200" : "text-white"}`}
                          >
                            {entry.username}
                          </p>
                          {/* MMR tier badge */}
                          <span
                            className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${mmrRank.colorClass} ${mmrRank.borderClass} ${mmrRank.glowClass}`}
                          >
                            {mmrRank.name.toUpperCase()}
                          </span>
                          {isMe && (
                            <span className="shrink-0 text-[10px] text-blue-400">
                              (you)
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">
                          {entry.wins}W · {entry.gamesPlayed}G
                        </p>
                      </div>

                      {/* MMR number */}
                      <div
                        className={`text-sm font-extrabold tabular-nums ${mmrRank.colorClass}`}
                      >
                        {entry.mmr}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <RankTierLegend />

            <p className="mt-4 text-[10px] text-slate-600 text-center">
              Leaderboard cache refreshes about every 10 minutes
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mode Card Component ── */
function ModeCard({
  icon,
  title,
  description,
  accentFrom,
  accentTo,
  glowColor,
  disabled,
  active,
  onClick,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accentFrom: string;
  accentTo: string;
  glowColor: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-3xl border p-6 text-left transition-all duration-200 ${
        active
          ? `border-blue-500/30 bg-blue-500/10 shadow-[0_0_30px_${glowColor}]`
          : disabled
            ? "cursor-not-allowed border-white/[0.05] bg-white/[0.02] opacity-60"
            : "border-white/[0.07] bg-white/[0.04] hover:border-white/[0.14] hover:bg-white/[0.07]"
      }`}
      style={
        active || !disabled
          ? { boxShadow: active ? `0 0 30px ${glowColor}` : undefined }
          : undefined
      }
    >
      {/* Gradient icon bg */}
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accentFrom} ${accentTo} text-white shadow-lg`}
      >
        {icon}
      </div>

      <h3 className="text-base font-bold text-white">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>

      {footer}

      {active && (
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-blue-300">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
          Searching…
        </div>
      )}

      {/* Hover glow overlay */}
      {!disabled && !active && (
        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 rounded-3xl"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${glowColor.replace("0.35", "0.08")}, transparent 70%)`,
          }}
        />
      )}
    </button>
  );
}
