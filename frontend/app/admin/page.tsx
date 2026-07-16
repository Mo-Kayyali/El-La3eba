"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Trophy, Shield } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, bootstrapped } = useAuthStore();

  useEffect(() => {
    if (!bootstrapped) return;
    if (!user || user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
  }, [bootstrapped, user, router]);

  if (!bootstrapped || !user || user.role !== "ADMIN") return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-extrabold text-white">Admin Dashboard</h1>
        <p className="mt-2 text-slate-400">
          Manage game data, competitions, clubs, and more.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/admin/competitions"
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center transition hover:border-blue-500/50 hover:bg-slate-800/50"
        >
          <div className="rounded-full bg-blue-500/10 p-4 text-blue-400 group-hover:bg-blue-500/20 group-hover:text-blue-300 transition-colors">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Competitions</h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage domestic and international competitions
            </p>
          </div>
        </Link>

        <Link
          href="/admin/clubs"
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center transition hover:border-emerald-500/50 hover:bg-slate-800/50"
        >
          <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors">
            <Shield className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Clubs & Teams</h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage football clubs, aliases, and logos
            </p>
          </div>
        </Link>

        <Link
          href="/admin/players"
          className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-slate-900/50 p-8 text-center transition hover:border-violet-500/50 hover:bg-slate-800/50"
        >
          <div className="rounded-full bg-violet-500/10 p-4 text-violet-400 group-hover:bg-violet-500/20 group-hover:text-violet-300 transition-colors">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Players</h2>
            <p className="mt-1 text-sm text-slate-400">
              Manage player profiles and club history
            </p>
          </div>
        </Link>

        <div className="group relative flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/5 bg-slate-900/20 p-8 text-center opacity-60 grayscale cursor-not-allowed">
          <div className="rounded-full bg-slate-500/10 p-4 text-slate-400">
            <svg
              className="h-8 w-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Questions</h2>
            <p className="mt-1 text-sm text-slate-400">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
