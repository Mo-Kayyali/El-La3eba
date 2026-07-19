"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSocketStore } from "@/src/store/socketStore";
import {
  IncomingGameInvite,
  useNotificationStore,
} from "@/src/store/notificationStore";

function canRenderOnPath(pathname: string) {
  if (pathname.startsWith("/game/")) return false;
  if (pathname === "/lobby") return true;
  if (pathname === "/friends") return true;
  if (pathname.startsWith("/profile")) return true;
  return false;
}

function InviteCard({ invite }: { invite: IncomingGameInvite }) {
  const socket = useSocketStore((s) => s.socket);
  const removeIncomingGameInvite = useNotificationStore(
    (s) => s.removeIncomingGameInvite,
  );
  const router = useRouter();

  function acceptInvite() {
    if (!socket?.connected) return;
    socket.emit(
      "acceptGameInvite",
      { inviterId: invite.inviterId },
      (response: {
        status?: string;
        gameSessionId?: string;
        message?: string;
      }) => {
        if (response?.status === "ok" && response.gameSessionId) {
          removeIncomingGameInvite(invite.inviterId);
          router.push(`/game/${response.gameSessionId}`);
          return;
        }
      },
    );
  }

  function declineInvite() {
    if (socket?.connected) {
      socket.emit("declineGameInvite", { inviterId: invite.inviterId });
    }
    removeIncomingGameInvite(invite.inviterId);
  }

  return (
    <div className="pointer-events-auto rounded-2xl border border-white/15 bg-[#0a1028]/95 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
        Game Invite
      </p>
      <p className="mt-1 text-sm font-semibold text-white">
        {invite.inviterUsername} invited you
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Room code: {invite.roomCode}
      </p>
      {invite.config && (
        <p className="mt-1 text-xs text-slate-400">
          {[
            invite.config.composition.filter((m) => m === "STRIKES").length > 0 &&
              `${invite.config.composition.filter((m) => m === "STRIKES").length}x Strikes`,
            invite.config.composition.filter((m) => m === "TOP_10").length > 0 &&
              `${invite.config.composition.filter((m) => m === "TOP_10").length}x Top 10`,
          ]
            .filter(Boolean)
            .join(", ")}{" "}
          &middot; {invite.config.timerConfig.STRIKES / 1000}s / {invite.config.timerConfig.TOP_10 / 1000}s timers
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={acceptInvite}
          className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-400"
        >
          Join Game
        </button>
        <button
          onClick={declineInvite}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export function GlobalInviteOverlay() {
  const pathname = usePathname();
  const invites = useNotificationStore((s) => s.incomingGameInvites);

  if (!canRenderOnPath(pathname) || invites.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[95] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
      {invites.map((invite) => (
        <InviteCard key={invite.inviterId} invite={invite} />
      ))}
    </div>
  );
}
