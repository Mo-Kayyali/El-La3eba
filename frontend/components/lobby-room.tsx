"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Play,
  Repeat2,
  Settings2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { RoomConfigModal, RoomConfig } from "@/components/room-config-modal";
import { useAuthStore } from "@/lib/auth-store";
import { useFriendsList } from "@/hooks/use-friends-list";
import { useNotificationStore } from "@/src/store/notificationStore";
import { useLobbyStore } from "@/src/store/lobbyStore";
import { useSocketStore } from "@/src/store/socketStore";

interface LobbyRoomProps {
  roomCode: string;
}

export function LobbyRoom({ roomCode }: LobbyRoomProps) {
  const router = useRouter();
  const socket = useSocketStore((s) => s.socket);
  const isConnected = useSocketStore((s) => s.isConnected);
  const { user } = useAuthStore();
  const lobbyState = useLobbyStore((s) => s.lobbyData);
  const setLobbyState = useLobbyStore((s) => s.setLobbyData);
  const { friendsData } = useFriendsList();
  const friends = friendsData?.friends ?? [];
  const outgoingInvites = useNotificationStore((s) => s.outgoingInvites);
  const setOutgoingInvite = useNotificationStore((s) => s.setOutgoingInvite);
  const clearOutgoingInvite = useNotificationStore(
    (s) => s.clearOutgoingInvite,
  );

  const [isRestoringLobby, setIsRestoringLobby] = useState(!lobbyState);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [guestDisconnectedId, setGuestDisconnectedId] = useState<string | null>(
    null,
  );
  const [guestDisconnectSecondsLeft, setGuestDisconnectSecondsLeft] = useState<
    number | null
  >(null);

  const lobbyStateRef = useRef(lobbyState);
  const guestDisconnectedIdRef = useRef<string | null>(guestDisconnectedId);

  useEffect(() => {
    lobbyStateRef.current = lobbyState;
  }, [lobbyState]);

  useEffect(() => {
    guestDisconnectedIdRef.current = guestDisconnectedId;
  }, [guestDisconnectedId]);

  const isHost = user?.id === lobbyState?.hostId;
  const isGuest = user?.id === lobbyState?.guestId;
  const canStartMatch = lobbyState?.hostReady && lobbyState?.guestReady;
  const lobbyComposition = useMemo(
    () => lobbyState?.config?.composition ?? [],
    [lobbyState?.config?.composition],
  );
  const lobbyTimerConfig = lobbyState?.config?.timerConfig ?? {};

  useEffect(() => {
    setIsRestoringLobby(!lobbyState);
  }, [lobbyState]);

  useEffect(() => {
    if (!socket?.connected || !isConnected || !roomCode) return;

    const onLobbyStateUpdated = (newState: any) => {
      setLobbyState(newState);
      setIsRestoringLobby(false);
    };

    const onLobbyCancelledByHost = () => {
      toast.error("The host cancelled this lobby.");
      setLobbyState(null);
      setGuestDisconnectedId(null);
      setGuestDisconnectSecondsLeft(null);
      router.replace("/lobby");
    };

    const onLobbyPlayerDisconnected = (payload: { userId?: string }) => {
      const droppedUserId = payload?.userId ? String(payload.userId) : "";
      if (!droppedUserId || droppedUserId === String(user?.id)) return;
      if (droppedUserId !== String(lobbyStateRef.current?.guestId ?? ""))
        return;
      setGuestDisconnectedId(droppedUserId);
      setGuestDisconnectSecondsLeft(30);
      toast.message("Guest disconnected. Waiting for reconnect…");
    };

    const onLobbyPlayerReconnected = (payload: { userId?: string }) => {
      const reconnectedUserId = payload?.userId ? String(payload.userId) : "";
      if (!reconnectedUserId) return;
      if (reconnectedUserId !== guestDisconnectedIdRef.current) return;
      setGuestDisconnectedId(null);
      setGuestDisconnectSecondsLeft(null);
      toast.message("Guest reconnected.");
    };

    const onRoomExpired = () => {
      toast.error("Lobby expired after 15 minutes of inactivity.");
      setLobbyState(null);
      setGuestDisconnectedId(null);
      setGuestDisconnectSecondsLeft(null);
      router.replace("/lobby");
    };

    const onMatchFound = (payload: { gameSessionId?: string }) => {
      if (payload?.gameSessionId) {
        router.replace(`/game/${payload.gameSessionId}`);
      }
    };

    socket.emit("joinLobbyRoom", { roomCode }, (response: any) => {
      if (response?.status === "success" && response.roomData) {
        setLobbyState(response.roomData);
      } else if (!lobbyStateRef.current) {
        toast.error(response?.message ?? "Could not load lobby.");
        router.replace("/lobby");
      }
      setIsRestoringLobby(false);
    });

    socket.on("lobbyStateUpdated", onLobbyStateUpdated);
    socket.on("lobbyCancelledByHost", onLobbyCancelledByHost);
    socket.on("lobbyPlayerDisconnected", onLobbyPlayerDisconnected);
    socket.on("lobbyPlayerReconnected", onLobbyPlayerReconnected);
    socket.on("roomExpired", onRoomExpired);
    socket.on("matchFound", onMatchFound);

    return () => {
      socket.off("lobbyStateUpdated", onLobbyStateUpdated);
      socket.off("lobbyCancelledByHost", onLobbyCancelledByHost);
      socket.off("lobbyPlayerDisconnected", onLobbyPlayerDisconnected);
      socket.off("lobbyPlayerReconnected", onLobbyPlayerReconnected);
      socket.off("roomExpired", onRoomExpired);
      socket.off("matchFound", onMatchFound);
    };
  }, [isConnected, roomCode, router, setLobbyState, socket, user?.id]);

  useEffect(() => {
    if (!guestDisconnectedId || guestDisconnectSecondsLeft === null) return;
    if (guestDisconnectSecondsLeft <= 0) return;

    const timer = window.setInterval(() => {
      setGuestDisconnectSecondsLeft((current) => {
        if (current === null) return current;
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [guestDisconnectedId, guestDisconnectSecondsLeft]);

  useEffect(() => {
    if (!socket) return;

    const onInviteCancelledBySystem = (payload: {
      inviteeId?: string;
      reason?: string;
    }) => {
      if (payload?.inviteeId) {
        clearOutgoingInvite(payload.inviteeId);
        if (payload.reason === "room_full") {
          toast.error("Invite cancelled because the room is full.");
        }
      }
    };

    socket.on("inviteCancelledBySystem", onInviteCancelledBySystem);
    return () => {
      socket.off("inviteCancelledBySystem", onInviteCancelledBySystem);
    };
  }, [clearOutgoingInvite, socket]);

  const handleToggleReady = () => {
    if (!socket?.connected) return;
    socket.emit("toggleLobbyReady", (response: any) => {
      if (response?.error) toast.error(response.error);
    });
  };

  const handleStartMatch = () => {
    if (!socket?.connected) return;
    socket.emit("startLobbyMatch", (response: any) => {
      if (response?.error) toast.error(response.error);
    });
  };

  const handleEditConfig = () => {
    setIsConfigModalOpen(true);
  };

  const handleCancelLobby = () => {
    setIsCancelConfirmOpen(true);
  };

  const handleConfirmCancelLobby = () => {
    if (!socket?.connected) return;
    socket.emit("cancelPrivateRoom", (response: any) => {
      if (response?.error) {
        toast.error(response.error);
        return;
      }
      toast.message("Lobby cancelled.");
      setLobbyState(null);
      router.replace("/lobby");
    });
    setIsCancelConfirmOpen(false);
  };

  const handleConfirmConfig = (config: RoomConfig) => {
    if (!socket?.connected) return;
    socket.emit("updateLobbyConfig", { config }, (response: any) => {
      if (response?.status === "success" && response.roomData) {
        setLobbyState(response.roomData);
        toast.success("Lobby configuration updated.");
        setIsConfigModalOpen(false);
      } else {
        toast.error(response?.message ?? "Could not update configuration.");
      }
    });
  };

  const handleLeaveLobby = () => {
    if (!socket?.connected) return;
    socket.emit("leaveLobby", (response: any) => {
      if (response?.error) {
        toast.error(response.error);
        return;
      }
      setLobbyState(null);
      router.replace("/lobby");
    });
  };

  const handleInviteFriend = (friendId: string, friendName: string) => {
    if (!socket?.connected) return;

    const pendingInvite = outgoingInvites[friendId];
    if (pendingInvite) {
      socket.emit("cancelGameInvite", { friendId }, (response: any) => {
        if (response?.status === "ok") {
          clearOutgoingInvite(friendId);
          toast.message(`Invite cancelled for ${friendName}.`);
        } else {
          toast.error(response?.message ?? "Could not cancel invite.");
        }
      });
      return;
    }

    socket.emit(
      "sendGameInvite",
      { friendId, config: lobbyState?.config },
      (response: any) => {
        if (response?.status === "success" && response.roomCode) {
          setOutgoingInvite({
            friendId,
            roomCode: response.roomCode,
            status: "pending",
            expiresAt: Date.now() + 60_000,
          });
          toast.success(`Invite sent to ${friendName}.`);
        } else {
          toast.error(response?.message ?? "Could not send invite.");
        }
      },
    );
  };

  if (isRestoringLobby || !lobbyState) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100 p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/lobby")}
              className="mb-2 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Lobby Menu
            </button>
            <h1 className="text-3xl font-extrabold text-white">
              Private Lobby
            </h1>
            <p className="mt-1 font-mono uppercase tracking-[0.2em] text-sky-300">
              ROOM CODE: {roomCode}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 justify-end">
            {isHost && (
              <>
                <button
                  onClick={handleEditConfig}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
                >
                  <Settings2 className="h-4 w-4" />
                  Edit Configuration
                </button>
                <button
                  onClick={handleStartMatch}
                  disabled={!canStartMatch}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
                    canStartMatch
                      ? "bg-sky-500 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)] hover:bg-sky-400"
                      : "cursor-not-allowed border border-white/10 bg-white/5 text-white/50"
                  }`}
                >
                  <Play className="h-4 w-4" />
                  Start Match
                </button>
              </>
            )}
            <button
              onClick={isHost ? handleCancelLobby : handleLeaveLobby}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
            >
              {isHost ? "Cancel Lobby" : "Leave Lobby"}
            </button>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
                Configuration
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Composition and timers currently stored on the lobby.
              </p>
            </div>
            {isHost && (
              <button
                onClick={handleEditConfig}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.09]"
              >
                Edit
              </button>
            )}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Composition
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lobbyComposition.length > 0 ? (
                  lobbyComposition.map((mode, index) => (
                    <span
                      key={`${mode}-${index}`}
                      className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-100"
                    >
                      {index + 1}. {mode.replace("_", " ")}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    No composition configured.
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Timers
              </p>
              <div className="mt-3 space-y-2">
                {Object.entries(lobbyTimerConfig).length > 0 ? (
                  Object.entries(lobbyTimerConfig).map(([mode, timerMs]) => (
                    <div
                      key={mode}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-white">
                        {mode.replace("_", " ")}
                      </span>
                      <span className="text-slate-300">
                        {Math.round(Number(timerMs) / 1000)}s
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">
                    No timers configured.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {isHost && guestDisconnectedId && (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <div className="flex items-center gap-2 font-semibold">
              <Repeat2 className="h-4 w-4" />
              Guest disconnected
            </div>
            <p className="mt-1 text-amber-50/90">
              Waiting for reconnect
              {guestDisconnectSecondsLeft !== null
                ? ` · ${guestDisconnectSecondsLeft}s left`
                : ""}
              .
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-400">
              Players
            </h2>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/20 text-indigo-400">
                  <User className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">
                    {lobbyState.hostUsername}
                    <span className="ml-2 rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300">
                      HOST
                    </span>
                  </p>
                  <p className="text-sm text-slate-400">Host</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {lobbyState.hostReady && (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready
                  </span>
                )}
                {isHost && (
                  <button
                    onClick={handleToggleReady}
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                      lobbyState.hostReady
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-emerald-500 text-white hover:bg-emerald-400"
                    }`}
                  >
                    {lobbyState.hostReady ? "Unready" : "Ready Up"}
                  </button>
                )}
              </div>
            </div>

            <div
              className={`flex items-center justify-between rounded-2xl border p-6 transition-colors ${
                lobbyState.guestId
                  ? "border-white/10 bg-white/[0.03]"
                  : "border-dashed border-white/5 bg-transparent"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500">
                  {lobbyState.guestId ? (
                    <User className="h-6 w-6 text-sky-400" />
                  ) : (
                    <Users className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-lg font-bold ${lobbyState.guestId ? "text-white" : "text-slate-500"}`}
                  >
                    {lobbyState.guestUsername || "Waiting for opponent..."}
                  </p>
                  <p className="text-sm text-slate-400">Guest</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {lobbyState.guestReady && (
                  <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready
                  </span>
                )}
                {isGuest && (
                  <button
                    onClick={handleToggleReady}
                    className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                      lobbyState.guestReady
                        ? "bg-white/10 text-white hover:bg-white/20"
                        : "bg-emerald-500 text-white hover:bg-emerald-400"
                    }`}
                  >
                    {lobbyState.guestReady ? "Unready" : "Ready Up"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {isHost && (
            <div className="h-fit rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-300">
                  Invite Friends
                </h2>
                <button
                  onClick={() => router.push("/friends")}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  <UserPlus className="h-3 w-3" />
                  Add
                </button>
              </div>

              {friends.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  You have no friends on your list.
                </p>
              ) : (
                <div className="custom-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-2">
                  {friends.map((friend) => {
                    const presenceStatus = friend.presence?.status ?? "offline";
                    const isOnline = presenceStatus === "online";
                    const pendingInvite = outgoingInvites[friend.userId];

                    return (
                      <div
                        key={friend.userId}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`}
                          />
                          <div>
                            <p className="max-w-[100px] truncate text-sm font-semibold text-white">
                              {friend.username}
                            </p>
                            <p className="text-[10px] capitalize text-slate-400">
                              {presenceStatus}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            handleInviteFriend(friend.userId, friend.username)
                          }
                          disabled={!isOnline && !pendingInvite}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                            pendingInvite
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : isOnline
                                ? "bg-sky-500 text-white hover:bg-sky-400"
                                : "cursor-not-allowed bg-white/5 text-slate-500"
                          }`}
                        >
                          {pendingInvite ? "Cancel" : "Invite"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        title="Cancel this lobby?"
        message="This will destroy the room and notify the guest if they are present. They will need a new invite or room code to rejoin."
        onConfirm={handleConfirmCancelLobby}
        confirmText="Cancel Lobby"
        isDestructive
      />

      <RoomConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConfirm={handleConfirmConfig}
        initialConfig={lobbyState?.config}
      />
    </div>
  );
}
