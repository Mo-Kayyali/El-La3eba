"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useSocketStore } from "@/src/store/socketStore";

export default function LobbyPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, logout } = useAuthStore();
  const { socket, connectSocket, disconnectSocket } = useSocketStore();

  const username = useMemo(
    () => user?.username ?? user?.email ?? "Player",
    [user?.username, user?.email]
  );

  const [isSearching, setIsSearching] = useState(false);

  // Private match — create flow
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [isWaitingForFriend, setIsWaitingForFriend] = useState(false);

  // Private match — join flow
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) {
      router.replace("/");
      return;
    }

    connectSocket(accessToken);
    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, router]);

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

      alert(message);
      setIsSearching(false);

      // If auth is invalid/expired, send user back to login.
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#06080d] text-zinc-100 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
          <h1 className="text-xl font-semibold text-white">Lobby</h1>
          <p className="mt-2 text-sm text-zinc-300">
            You’re not logged in. Head back to authentication.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15 transition"
          >
            Go to Auth
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060a] text-zinc-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute -bottom-44 right-[-120px] h-[520px] w-[520px] rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),transparent_35%,rgba(0,0,0,0.25))]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.2em] text-zinc-400">EL-LA3EBA</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              Matchmaking Lobby
            </h1>
            <p className="mt-2 text-sm text-zinc-300">
              Welcome back, <span className="font-semibold text-white">{username}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                disconnectSocket();
                logout();
                router.replace("/");
              }}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.09] hover:border-white/20 transition"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Ranked Queue</h2>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  socket?.connected
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 bg-white/[0.06] text-zinc-300"
                }`}
              >
                {socket?.connected ? "Online" : "Connecting..."}
              </span>
            </div>

            <p className="mt-2 text-sm text-zinc-300">
              Jump into the queue and get paired instantly.
            </p>

            <button
              disabled={isSearching || !socket?.connected}
              onClick={() => {
                if (!socket?.connected) return;
                setIsSearching(true);
                socket.emit("joinQueue");
              }}
              className={`group relative mt-6 w-full overflow-hidden rounded-3xl px-6 py-5 text-center text-base font-semibold transition ${
                isSearching || !socket?.connected
                  ? "cursor-not-allowed bg-white/10 text-zinc-300"
                  : "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black hover:brightness-110"
              }`}
            >
              {!isSearching ? (
                <span className="relative z-10">Find Match</span>
              ) : (
                <span className="relative z-10 inline-flex items-center justify-center gap-3">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Searching for opponent...
                </span>
              )}

              {!isSearching && socket?.connected && (
                <span className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
                  <span className="absolute inset-[-2px] rounded-3xl bg-gradient-to-r from-fuchsia-500/40 to-cyan-400/40 blur-xl" />
                </span>
              )}
            </button>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
              Tip: if you get stuck searching, refresh the page to reconnect.
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
            <h2 className="text-lg font-semibold text-white">Private Match</h2>
            <p className="mt-2 text-sm text-zinc-300">
              Create a room for friends, or join using a code.
            </p>

            <div className="mt-6 grid gap-4">
              {/* ── Create flow ── */}
              {!isWaitingForFriend ? (
                <button
                  disabled={isCreatingRoom || !socket?.connected}
                  onClick={() => {
                    if (!socket?.connected) return;
                    setIsCreatingRoom(true);
                    setCreatedRoomCode(null);
                    socket.emit(
                      "createPrivateMatch",
                      (response: { status: string; roomCode?: string }) => {
                        setIsCreatingRoom(false);
                        if (response?.status === "success" && response.roomCode) {
                          setCreatedRoomCode(response.roomCode);
                          setIsWaitingForFriend(true);
                        }
                      },
                    );
                  }}
                  className={`w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white transition ${
                    isCreatingRoom || !socket?.connected
                      ? "cursor-not-allowed opacity-60"
                      : "hover:border-white/20 hover:bg-black/40"
                  }`}
                >
                  {isCreatingRoom ? "Creating…" : "Create Room"}
                </button>
              ) : (
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                  <p className="text-xs font-semibold tracking-wide text-cyan-300">
                    YOUR ROOM CODE
                  </p>
                  <p className="mt-2 text-center text-3xl font-extrabold tracking-[0.25em] text-white">
                    {createdRoomCode}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs text-zinc-300">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                      Waiting for friend…
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdRoomCode ?? "");
                      }}
                      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/[0.1] transition"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setIsWaitingForFriend(false);
                      setCreatedRoomCode(null);
                    }}
                    className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-white/[0.08] transition"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* ── Join flow ── */}
              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <label className="block text-xs font-semibold tracking-wide text-zinc-400">
                  ROOM CODE
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={roomCode}
                    onChange={(e) => {
                      setRoomCode(e.target.value.toUpperCase().slice(0, 6));
                      setJoinError(null);
                    }}
                    placeholder="e.g. A1B2C3"
                    maxLength={6}
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                  />
                  <button
                    disabled={isJoining || !socket?.connected || roomCode.trim().length < 6}
                    onClick={() => {
                      const code = roomCode.trim();
                      if (!code || !socket?.connected) return;
                      setIsJoining(true);
                      setJoinError(null);
                      socket.emit(
                        "joinPrivateMatch",
                        { roomCode: code },
                        (response: { success?: boolean; error?: string; status?: string }) => {
                          setIsJoining(false);
                          if (response?.success === false || response?.status === "error") {
                            setJoinError(response?.error ?? "Failed to join room");
                          }
                          // On success the server emits matchFound which is already handled above.
                        },
                      );
                    }}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition ${
                      isJoining || !socket?.connected || roomCode.trim().length < 6
                        ? "cursor-not-allowed bg-white/10 opacity-60"
                        : "bg-white/10 hover:bg-white/15"
                    }`}
                  >
                    {isJoining ? "…" : "Join"}
                  </button>
                </div>
                {joinError && (
                  <p className="mt-2 text-xs font-semibold text-red-300">{joinError}</p>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

