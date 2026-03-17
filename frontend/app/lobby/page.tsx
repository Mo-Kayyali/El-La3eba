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
  const [roomCode, setRoomCode] = useState("");

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
              <button
                onClick={() => {
                  alert("Create Room: hook up your socket event here.");
                }}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white hover:border-white/20 hover:bg-black/40 transition"
              >
                Create Room
              </button>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                <label className="block text-xs font-semibold tracking-wide text-zinc-400">
                  ROOM CODE
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="e.g. A1B2C3"
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
                  />
                  <button
                    onClick={() => {
                      const code = roomCode.trim();
                      if (!code) return;
                      alert(`Join Room (${code}): hook up your socket event here.`);
                    }}
                    className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition"
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

