"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "../../lib/auth-store";

export default function LobbyPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

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
    <div className="min-h-screen bg-[#06080d] text-zinc-100 flex items-center justify-center px-6">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
        <h1 className="text-2xl font-semibold text-white">Lobby</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Logged in as{" "}
          <span className="text-white font-medium">
            {user?.username ?? user?.email ?? "Player"}
          </span>
          .
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={() => logout()}
            className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white hover:border-white/20 hover:bg-black/40 transition"
          >
            Logout
          </button>
          <button
            onClick={() => router.push("/")}
            className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-500 px-4 py-3 text-sm font-semibold text-black hover:brightness-110 transition"
          >
            Back to Auth
          </button>
        </div>
      </div>
    </div>
  );
}

