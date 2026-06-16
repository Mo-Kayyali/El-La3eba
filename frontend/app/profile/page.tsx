"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, PencilLine, Trophy, Swords, Percent } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { refreshAuthProfile } from "@/lib/api";

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-200">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold text-white">{value}</p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, accessToken, bootstrapped } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const wins = typeof user?.wins === "number" ? user.wins : 0;
  const gamesPlayed =
    typeof user?.gamesPlayed === "number" ? user.gamesPlayed : 0;

  const winRate = useMemo(() => {
    if (gamesPlayed === 0) return 0;
    return (wins / gamesPlayed) * 100;
  }, [wins, gamesPlayed]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!accessToken) {
      router.replace("/");
    }
  }, [accessToken, bootstrapped, router]);

  useEffect(() => {
    if (!bootstrapped || !accessToken) return;
    void refreshAuthProfile();
  }, [accessToken, bootstrapped]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    if (!user?.id) return;
    await navigator.clipboard.writeText(String(user.id));
    setCopied(true);
  }

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400/40 border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_55%_at_50%_-10%,rgba(14,165,233,0.2),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_90%_100%,rgba(59,130,246,0.15),transparent_60%)]" />
      </div>

      <main className="relative mx-auto w-full max-w-5xl px-5 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_20px_80px_rgba(2,132,199,0.15)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
                Player Profile
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
                {user?.username ?? "Player"}
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Your account stats and identity card.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <PencilLine className="h-4 w-4" />
                Edit Profile
              </Link>
              <Link
                href="/lobby"
                className="rounded-xl border border-white/15 bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition hover:text-white"
              >
                Back to Lobby
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<Trophy className="h-4 w-4" />}
              label="Total Wins"
              value={String(wins)}
            />
            <StatCard
              icon={<Swords className="h-4 w-4" />}
              label="Matches Played"
              value={String(gamesPlayed)}
            />
            <StatCard
              icon={<Percent className="h-4 w-4" />}
              label="Win Rate"
              value={`${winRate.toFixed(1)}%`}
            />
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">
              Player UUID
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="break-all text-sm font-mono text-slate-200">
                {String(user?.id ?? "-")}
              </p>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!user?.id}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
