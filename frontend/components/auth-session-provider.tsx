"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { AppNavbar } from "@/components/app-navbar";
import { GlobalInviteOverlay } from "@/components/global-invite-overlay";
import {
  acknowledgeOfflinePenalty,
  api,
  refreshAuthProfile,
  syncAxiosAuthFromStore,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useSocketStore } from "@/src/store/socketStore";
import { useNotificationStore } from "@/src/store/notificationStore";

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped);
  const connectSocket = useSocketStore((s) => s.connectSocket);
  const disconnectSocket = useSocketStore((s) => s.disconnectSocket);
  const socket = useSocketStore((s) => s.socket);

  const incrementFriendRequests = useNotificationStore(
    (s) => s.incrementFriendRequests,
  );
  const addIncomingGameInvite = useNotificationStore(
    (s) => s.addIncomingGameInvite,
  );
  const removeIncomingGameInvite = useNotificationStore(
    (s) => s.removeIncomingGameInvite,
  );
  const clearOutgoingInvite = useNotificationStore(
    (s) => s.clearOutgoingInvite,
  );
  const setPendingFriendRequests = useNotificationStore(
    (s) => s.setPendingFriendRequests,
  );
  const resetInviteUiState = useNotificationStore((s) => s.resetInviteUiState);
  const resetAllNotifications = useNotificationStore(
    (s) => s.resetAllNotifications,
  );
  const pruneExpiredInvites = useNotificationStore(
    (s) => s.pruneExpiredInvites,
  );
  const [pendingOfflinePenalty, setPendingOfflinePenalty] = useState<{
    id: string;
    mmrLost: number;
    gameSessionId: string;
    createdAt: string;
  } | null>(null);
  const [acknowledgingPenalty, setAcknowledgingPenalty] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.subscribe(() => {
      syncAxiosAuthFromStore();
    });
    syncAxiosAuthFromStore();
    return unsub;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      await useAuthStore.persist.rehydrate();
      if (cancelled) return;
      syncAxiosAuthFromStore();
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        document.cookie =
          "el_la3eba_token=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax";
        resetAllNotifications();
      } else {
        document.cookie = `el_la3eba_token=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        const profile = await refreshAuthProfile();
        if (!cancelled) {
          setPendingFriendRequests(profile?.pendingIncomingFriendRequests ?? 0);
          setPendingOfflinePenalty(profile?.pendingOfflinePenalty ?? null);
        }
      }
      if (!cancelled) setBootstrapped(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [resetAllNotifications, setBootstrapped, setPendingFriendRequests]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!accessToken) {
      disconnectSocket();
      resetAllNotifications();
      return;
    }

    connectSocket(accessToken);
  }, [
    accessToken,
    bootstrapped,
    connectSocket,
    disconnectSocket,
    resetAllNotifications,
  ]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      resetInviteUiState();
    };

    const onFriendRequestCountSnapshot = (payload: {
      pendingIncomingFriendRequests?: number;
    }) => {
      if (typeof payload?.pendingIncomingFriendRequests === "number") {
        setPendingFriendRequests(payload.pendingIncomingFriendRequests);
      }
    };

    socket.on("connect", onConnect);
    socket.on("friendRequestCountSnapshot", onFriendRequestCountSnapshot);

    return () => {
      socket.off("connect", onConnect);
      socket.off("friendRequestCountSnapshot", onFriendRequestCountSnapshot);
    };
  }, [resetInviteUiState, setPendingFriendRequests, socket]);

  useEffect(() => {
    const onBeforeUnload = () => {
      disconnectSocket();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [disconnectSocket]);

  async function handleAcknowledgeOfflinePenalty() {
    if (acknowledgingPenalty) return;
    setAcknowledgingPenalty(true);
    try {
      await acknowledgeOfflinePenalty();
      setPendingOfflinePenalty(null);
    } finally {
      setAcknowledgingPenalty(false);
    }
  }

  useEffect(() => {
    if (!socket) return;

    const onFriendRequestReceived = () => {
      incrementFriendRequests();
    };

    const onFriendGameInvite = (payload: {
      inviterId?: string;
      inviterUsername?: string;
      roomCode?: string;
    }) => {
      if (!payload?.inviterId || !payload?.roomCode) return;
      addIncomingGameInvite({
        inviterId: payload.inviterId,
        inviterUsername: payload.inviterUsername ?? "A friend",
        roomCode: payload.roomCode,
        expiresAt: Date.now() + 60_000,
      });
    };

    const onInviteCancelledBySystem = (payload: {
      inviterId?: string;
      inviteeId?: string;
    }) => {
      if (payload?.inviterId) {
        removeIncomingGameInvite(payload.inviterId);
      }
      if (payload?.inviteeId) {
        clearOutgoingInvite(payload.inviteeId);
      }
    };

    const onInviteDeclined = (payload: { inviteeId?: string }) => {
      if (payload?.inviteeId) {
        clearOutgoingInvite(payload.inviteeId);
      }
    };

    const onInviteAccepted = (payload: {
      inviteeId?: string;
      gameSessionId?: string;
    }) => {
      if (payload?.inviteeId) {
        clearOutgoingInvite(payload.inviteeId);
      }
      if (payload?.gameSessionId) {
        router.push(`/game/${payload.gameSessionId}`);
      }
    };

    socket.on("friendRequestReceived", onFriendRequestReceived);
    socket.on("friendGameInvite", onFriendGameInvite);
    socket.on("inviteCancelledBySystem", onInviteCancelledBySystem);
    socket.on("inviteDeclined", onInviteDeclined);
    socket.on("inviteAccepted", onInviteAccepted);

    return () => {
      socket.off("friendRequestReceived", onFriendRequestReceived);
      socket.off("friendGameInvite", onFriendGameInvite);
      socket.off("inviteCancelledBySystem", onInviteCancelledBySystem);
      socket.off("inviteDeclined", onInviteDeclined);
      socket.off("inviteAccepted", onInviteAccepted);
    };
  }, [
    addIncomingGameInvite,
    clearOutgoingInvite,
    incrementFriendRequests,
    pruneExpiredInvites,
    removeIncomingGameInvite,
    router,
    socket,
  ]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      pruneExpiredInvites();
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [pruneExpiredInvites]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (pathname !== "/" && pathname !== "/lobby") return;
    if (!accessToken) return;

    let cancelled = false;
    void (async () => {
      try {
        const { data } = await api.get<{ gameSessionId: string | null }>(
          "/game/active-game",
        );
        if (cancelled) return;
        const gid = data?.gameSessionId;
        if (gid) router.replace(`/game/${gid}`);
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrapped, pathname, router, accessToken]);

  return (
    <>
      {isAuthenticated && <AppNavbar />}
      <div
        className={
          isAuthenticated &&
          (pathname === "/lobby" ||
            pathname === "/friends" ||
            pathname.startsWith("/profile"))
            ? "pt-16"
            : undefined
        }
      >
        {children}
      </div>
      <GlobalInviteOverlay />
      {pendingOfflinePenalty && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-400/25 bg-zinc-950 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
            <p className="text-xs uppercase tracking-[0.2em] text-red-300">
              Offline Forfeit
            </p>
            <h2 className="mt-2 text-xl font-extrabold text-white">
              You disconnected from an active match.
            </h2>
            <p className="mt-3 text-sm text-zinc-300">
              You forfeited game {pendingOfflinePenalty.gameSessionId} and lost{" "}
              <span className="font-bold text-red-300">
                {pendingOfflinePenalty.mmrLost} MMR
              </span>
              .
            </p>
            <button
              onClick={() => void handleAcknowledgeOfflinePenalty()}
              disabled={acknowledgingPenalty}
              className="mt-5 w-full rounded-2xl bg-red-500/90 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {acknowledgingPenalty ? "Acknowledging..." : "Acknowledge"}
            </button>
          </div>
        </div>
      )}
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
        className="!top-4 !right-4 !z-[100]"
        toastOptions={{
          classNames: {
            toast: "!border-white/10 !bg-zinc-900/95 !backdrop-blur-xl",
            closeButton:
              "!border-white/10 !bg-zinc-800/80 !text-zinc-100 hover:!bg-zinc-700",
          },
        }}
      />
    </>
  );
}
