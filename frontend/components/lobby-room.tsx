"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users, User, ArrowLeft, Send, CheckCircle2, UserPlus, Play } from "lucide-react";
import { useSocketStore } from "@/src/store/socketStore";
import { useAuthStore } from "@/lib/auth-store";
import { useFriendsList } from "@/hooks/use-friends-list";
import { useNotificationStore } from "@/src/store/notificationStore";
import { useLobbyStore } from "@/src/store/lobbyStore";

interface LobbyRoomProps {
  roomCode: string;
}

export function LobbyRoom({ roomCode }: LobbyRoomProps) {
  const router = useRouter();
  const socket = useSocketStore((s) => s.socket);
  const { user } = useAuthStore();
  const lobbyState = useLobbyStore((s) => s.lobbyData);
  const setLobbyState = useLobbyStore((s) => s.setLobbyData);
  
  const { friendsData } = useFriendsList();
  const friends = friendsData?.friends ?? [];
  const outgoingInvites = useNotificationStore((s) => s.outgoingInvites);
  const setOutgoingInvite = useNotificationStore((s) => s.setOutgoingInvite);
  const clearOutgoingInvite = useNotificationStore((s) => s.clearOutgoingInvite);

  const isHost = user?.id === lobbyState?.hostId;
  const isGuest = user?.id === lobbyState?.guestId;
  const canStartMatch = lobbyState?.hostReady && lobbyState?.guestReady;

  useEffect(() => {
    if (!socket) return;

    const onLobbyStateUpdated = (newState: any) => {
      setLobbyState(newState);
    };

    const onInviteCancelledBySystem = (payload: { inviteeId?: string; reason?: string }) => {
      if (payload?.inviteeId) {
        clearOutgoingInvite(payload.inviteeId);
        if (payload.reason === 'room_full') {
          toast.error("Invite cancelled because the room is full.");
        }
      }
    };

    const onRoomExpired = () => {
      toast.error("Lobby expired after 15 minutes of inactivity.");
      setLobbyState(null);
      router.replace("/lobby");
    };

    const onMatchFound = (payload: { gameSessionId?: string }) => {
      if (payload?.gameSessionId) {
        router.replace(`/game/${payload.gameSessionId}`);
      }
    };

    socket.on("lobbyStateUpdated", onLobbyStateUpdated);
    socket.on("inviteCancelledBySystem", onInviteCancelledBySystem);
    socket.on("roomExpired", onRoomExpired);
    socket.on("matchFound", onMatchFound);

    return () => {
      socket.off("lobbyStateUpdated", onLobbyStateUpdated);
      socket.off("inviteCancelledBySystem", onInviteCancelledBySystem);
      socket.off("roomExpired", onRoomExpired);
      socket.off("matchFound", onMatchFound);
    };
  }, [socket, router, clearOutgoingInvite, setLobbyState]);

  const handleToggleReady = () => {
    if (!socket?.connected) return;
    socket.emit("toggleLobbyReady", (response: any) => {
      if (response?.error) {
        toast.error(response.error);
      }
    });
  };

  const handleStartMatch = () => {
    if (!socket?.connected) return;
    socket.emit("startLobbyMatch", (response: any) => {
      if (response?.error) {
        toast.error(response.error);
      }
    });
  };

  const handleCancelLobby = () => {
    if (!socket?.connected) return;
    socket.emit("cancelPrivateRoom", (response: any) => {
      if (response?.error) {
        toast.error(response.error);
      } else {
        setLobbyState(null);
        router.replace("/lobby");
      }
    });
  };

  const handleLeaveLobby = () => {
    if (!socket?.connected) return;
    socket.emit("leaveLobby", (response: any) => {
      if (response?.error) {
        toast.error(response.error);
      } else {
        setLobbyState(null);
        router.replace("/lobby");
      }
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

    socket.emit("sendGameInvite", { friendId, config: lobbyState?.config }, (response: any) => {
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
    });
  };

  if (!lobbyState) {
    return (
      <div className="min-h-screen bg-[#030712] text-slate-100 flex items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push("/lobby")} className="text-slate-400 hover:text-white flex items-center gap-2 mb-2 text-sm transition">
              <ArrowLeft className="w-4 h-4" /> Back to Lobby Menu
            </button>
            <h1 className="text-3xl font-extrabold text-white">Private Lobby</h1>
            <p className="text-sky-300 mt-1 font-mono tracking-[0.2em] uppercase">ROOM CODE: {roomCode}</p>
          </div>
          <div className="flex gap-3">
            {isHost && (
              <button onClick={handleStartMatch} disabled={!canStartMatch} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition ${canStartMatch ? 'bg-sky-500 hover:bg-sky-400 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'bg-white/5 text-white/50 cursor-not-allowed border border-white/10'}`}>
                <Play className="w-4 h-4" /> Start Match
              </button>
            )}
            <button onClick={isHost ? handleCancelLobby : handleLeaveLobby} className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition">
              {isHost ? "Cancel Lobby" : "Leave Lobby"}
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          {/* Players Area */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Players</h2>
            
            {/* Host Slot */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-lg text-white">{lobbyState.hostUsername} <span className="text-xs text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full ml-2">HOST</span></p>
                  <p className="text-sm text-slate-400">Host</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {lobbyState.hostReady && <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-bold"><CheckCircle2 className="w-4 h-4" /> Ready</span>}
                {isHost && (
                  <button onClick={handleToggleReady} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${lobbyState.hostReady ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`}>
                    {lobbyState.hostReady ? "Unready" : "Ready Up"}
                  </button>
                )}
              </div>
            </div>

            {/* Guest Slot */}
            <div className={`rounded-2xl border ${lobbyState.guestId ? 'border-white/10 bg-white/[0.03]' : 'border-white/5 border-dashed bg-transparent'} p-6 flex items-center justify-between transition-colors`}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/5 text-slate-500 flex items-center justify-center border border-white/10">
                  {lobbyState.guestId ? <User className="w-6 h-6 text-sky-400" /> : <Users className="w-6 h-6" />}
                </div>
                <div>
                  <p className={`font-bold text-lg ${lobbyState.guestId ? 'text-white' : 'text-slate-500'}`}>{lobbyState.guestUsername || "Waiting for opponent..."}</p>
                  <p className="text-sm text-slate-400">Guest</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {lobbyState.guestReady && <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-bold"><CheckCircle2 className="w-4 h-4" /> Ready</span>}
                {isGuest && (
                  <button onClick={handleToggleReady} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition ${lobbyState.guestReady ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-emerald-500 hover:bg-emerald-400 text-white'}`}>
                    {lobbyState.guestReady ? "Unready" : "Ready Up"}
                  </button>
                )}
              </div>
            </div>

          </div>

          {/* Sidebar Area (Invite Friends) */}
          {isHost && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 h-fit backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Invite Friends</h2>
                <button onClick={() => router.push('/friends')} className="text-sky-400 hover:text-sky-300 text-xs flex items-center gap-1">
                  <UserPlus className="w-3 h-3" /> Add
                </button>
              </div>

              {friends.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">You have no friends on your list.</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {friends.map((friend) => {
                    const presenceStatus = friend.presence?.status ?? "offline";
                    const isOnline = presenceStatus === "online";
                    const pendingInvite = outgoingInvites[friend.userId];

                    return (
                      <div key={friend.userId} className="flex items-center justify-between bg-white/5 border border-white/5 rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          <div>
                            <p className="text-sm font-semibold text-white truncate max-w-[100px]">{friend.username}</p>
                            <p className="text-[10px] text-slate-400 capitalize">{presenceStatus}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleInviteFriend(friend.userId, friend.username)}
                          disabled={!isOnline && !pendingInvite}
                          className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${pendingInvite ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : isOnline ? 'bg-sky-500 text-white hover:bg-sky-400' : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}
                        >
                          {pendingInvite ? 'Cancel' : 'Invite'}
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
    </div>
  );
}
