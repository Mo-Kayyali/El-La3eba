"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, User, Users } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useSocketStore } from "@/src/store/socketStore";
import { useNotificationStore } from "@/src/store/notificationStore";

function isActive(pathname: string, href: string) {
  if (href === "/profile") return pathname.startsWith("/profile");
  return pathname === href;
}

export function AppNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const disconnectSocket = useSocketStore((s) => s.disconnectSocket);
  const pendingFriendRequests = useNotificationStore(
    (s) => s.pendingFriendRequests,
  );

  const username = user?.username ?? user?.email ?? "Player";

  const showNavbar =
    pathname === "/lobby" ||
    pathname === "/friends" ||
    pathname.startsWith("/profile");

  if (!showNavbar) return null;

  return (
    <header className="fixed left-0 right-0 top-0 z-[90] border-b border-white/10 bg-[#050b1f]/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-3">
        <Link
          href="/lobby"
          className="text-lg font-black tracking-tight text-white"
        >
          El-La3eba
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/lobby"
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              isActive(pathname, "/lobby")
                ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            Lobby
          </Link>
          <Link
            href="/friends"
            className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              isActive(pathname, "/friends")
                ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Friends
            {pendingFriendRequests > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                +{pendingFriendRequests}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              isActive(pathname, "/profile")
                ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            {username}
          </Link>
          <button
            onClick={() => {
              disconnectSocket();
              logout();
              router.replace("/");
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}
