"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AppNavbar } from "@/components/app-navbar";
import { GlobalInviteOverlay } from "@/components/global-invite-overlay";
import { api, refreshAuthProfile, syncAxiosAuthFromStore } from "@/lib/api";
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
  const pruneExpiredInvites = useNotificationStore(
    (s) => s.pruneExpiredInvites,
  );

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
      if (token) await refreshAuthProfile();
      if (!cancelled) setBootstrapped(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [setBootstrapped]);

  useEffect(() => {
    if (!bootstrapped) return;
    if (!accessToken) {
      disconnectSocket();
      return;
    }

    connectSocket(accessToken);
  }, [accessToken, bootstrapped, connectSocket, disconnectSocket]);

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
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        className="!top-4 !right-4 !z-[100]"
        toastOptions={{
          classNames: {
            toast: "!border-white/10 !bg-zinc-900/95 !backdrop-blur-xl",
          },
        }}
      />
    </>
  );
}
