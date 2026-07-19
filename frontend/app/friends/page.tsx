"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { BadgeAlert, BellOff, MessageSquarePlus, RefreshCw, Trophy, UserCheck, UserMinus, UserPlus, X, Gamepad2, Search, Plus, Swords, Users, UserRound } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";
import { RoomConfigModal, RoomConfig } from "@/components/room-config-modal";
import {
  acceptFriendRequest,
  cancelOutgoingRequest,
  extractApiErrorMessage,
  fetchFriends,
  FriendEntry,
  FriendPresence,
  FriendsResponse,
  rejectFriendRequest,
  removeFriend,
  PresenceStatus,
  refreshAuthProfile,
  sendFriendRequest,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useSocketStore } from "@/src/store/socketStore";
import { useNotificationStore } from "@/src/store/notificationStore";

function systemInviteCancelMessage(reason?: string) {
  switch (reason) {
    case "invite_expired":
      return "Invite expired after 60 seconds.";
    case "invitee_offline":
      return "Invite cancelled because your friend went offline.";
    case "invitee_in_game":
      return "Invite cancelled because your friend joined a game.";
    case "inviter_in_game":
      return "Invite cancelled because you joined a game.";
    case "inviter_offline":
      return "Invite cancelled because the inviter went offline.";
    default:
      return "Invite expired or player went offline.";
  }
}

function statusClass(status?: string) {
  switch (status) {
    case "online":
      return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]";
    case "in-game":
      return "bg-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.75)]";
    default:
      return "bg-slate-500";
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case "online":
      return "Online";
    case "in-game":
      return "In-Game";
    default:
      return "Offline";
  }
}

export default function FriendsPage() {
  const router = useRouter();
  const { accessToken, bootstrapped, isAuthenticated } = useAuthStore();
  const socket = useSocketStore((s) => s.socket);

  const outgoingInvites = useNotificationStore((s) => s.outgoingInvites);
  const setOutgoingInvite = useNotificationStore((s) => s.setOutgoingInvite);
  const clearOutgoingInvite = useNotificationStore(
    (s) => s.clearOutgoingInvite,
  );
  const setPendingFriendRequests = useNotificationStore(
    (s) => s.setPendingFriendRequests,
  );

  const [friendsData, setFriendsData] = useState<FriendsResponse | null>(null);
  const [inviteModalFriend, setInviteModalFriend] = useState<FriendEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingRemovalFriend, setPendingRemovalFriend] =
    useState<FriendEntry | null>(null);
  const [isRemovingFriend, setIsRemovingFriend] = useState(false);

  const friends = friendsData?.friends ?? [];
  const incomingRequests = friendsData?.incomingRequests ?? [];
  const outgoingRequests = friendsData?.outgoingRequests ?? [];

  useEffect(() => {
    if (!bootstrapped) return;
    if (!accessToken) {
      router.replace("/");
      setPendingFriendRequests(0);
    }
  }, [accessToken, bootstrapped, router, setPendingFriendRequests]);

  useEffect(() => {
    if (!bootstrapped || !accessToken) return;
    void refreshAuthProfile();
  }, [accessToken, bootstrapped]);

  useEffect(() => {
    if (!bootstrapped || !isAuthenticated || !accessToken) return;

    const loadFriends = async () => {
      setLoading(true);
      try {
        const data = await fetchFriends();
        setFriendsData(data);
        setPendingFriendRequests(data.incomingRequests.length);
      } catch {
        setFriendsData({
          friends: [],
          incomingRequests: [],
          outgoingRequests: [],
        });
        setPendingFriendRequests(0);
      } finally {
        setLoading(false);
      }
    };

    void loadFriends();
  }, [accessToken, bootstrapped, isAuthenticated, setPendingFriendRequests]);

  useEffect(() => {
    if (!socket) return;

    const onFriendsPresenceUpdated = (payload: {
      friends?: FriendPresence[];
    }) => {
      const updates = payload?.friends ?? [];
      setFriendsData((current) => {
        if (!current) return current;
        const nextFriends = current.friends.map((friend) => {
          const match = updates.find(
            (entry) => String(entry.userId) === String(friend.userId),
          );
          if (!match) return friend;
          return {
            ...friend,
            presence: {
              status: match.status,
              gameSessionId: match.gameSessionId ?? null,
            },
          };
        });
        return { ...current, friends: nextFriends };
      });
    };

    socket.on("friendsPresenceUpdated", onFriendsPresenceUpdated);

    return () => {
      socket.off("friendsPresenceUpdated", onFriendsPresenceUpdated);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const onInviteCancelledBySystem = (payload: {
      inviteeId?: string;
      reason?: string;
    }) => {
      if (!payload?.inviteeId) return;
      const hadPendingInvite = Boolean(outgoingInvites[payload.inviteeId]);
      clearOutgoingInvite(payload.inviteeId);
      if (hadPendingInvite) {
        toast.message(systemInviteCancelMessage(payload.reason));
      }
    };

    socket.on("inviteCancelledBySystem", onInviteCancelledBySystem);

    return () => {
      socket.off("inviteCancelledBySystem", onInviteCancelledBySystem);
    };
  }, [clearOutgoingInvite, outgoingInvites, socket]);

  async function handleAddFriend() {
    const value = identifier.trim();
    if (!value || submitting || !socket?.connected) return;

    setSubmitting(true);
    setActionMessage(null);
    try {
      const response = await sendFriendRequest(value);
      if (response.created) {
        toast.success(
          `Friend request sent to ${response.friendship.username}.`,
        );
      } else if (response.accepted) {
        toast.success(
          `Friend request resolved with ${response.friendship.username}.`,
        );
      }
      setActionMessage(
        response.accepted
          ? `Friend request resolved with ${response.friendship.username}.`
          : `Friend request sent to ${response.friendship.username}.`,
      );
      setIdentifier("");
      const refreshed = await fetchFriends();
      setFriendsData(refreshed);
      setPendingFriendRequests(refreshed.incomingRequests.length);
    } catch (error) {
      const message = extractApiErrorMessage(error, "Failed to send request.");
      setActionMessage(message);
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error(message);
      } else {
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(requestId: string) {
    try {
      await acceptFriendRequest(requestId);
      const refreshed = await fetchFriends();
      setFriendsData(refreshed);
      setPendingFriendRequests(refreshed.incomingRequests.length);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Could not accept request.",
      );
    }
  }

  async function handleReject(requestId: string) {
    try {
      await rejectFriendRequest(requestId);
      const refreshed = await fetchFriends();
      setFriendsData(refreshed);
      setPendingFriendRequests(refreshed.incomingRequests.length);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Could not reject request.",
      );
    }
  }

  async function handleCancelOutgoing(requestId: string) {
    try {
      await cancelOutgoingRequest(requestId);
      const refreshed = await fetchFriends();
      setFriendsData(refreshed);
      setPendingFriendRequests(refreshed.incomingRequests.length);
      toast.success("Outgoing request cancelled.");
    } catch (error) {
      const message = extractApiErrorMessage(
        error,
        "Could not cancel outgoing request.",
      );
      setActionMessage(message);
      toast.error(message);
    }
  }

  async function handleRemoveFriend(friendshipId: string) {
    setIsRemovingFriend(true);
    try {
      await removeFriend(friendshipId);
      const refreshed = await fetchFriends();
      setFriendsData(refreshed);
      setPendingFriendRequests(refreshed.incomingRequests.length);
      toast.success("Friend removed.");
      setPendingRemovalFriend(null);
    } catch (error) {
      const message = extractApiErrorMessage(error, "Could not remove friend.");
      setActionMessage(message);
      toast.error(message);
    } finally {
      setIsRemovingFriend(false);
    }
  }

  function openRemoveFriendConfirmation(friend: FriendEntry) {
    setPendingRemovalFriend(friend);
  }

  async function confirmRemoveFriend() {
    if (!pendingRemovalFriend || isRemovingFriend) return;
    await handleRemoveFriend(pendingRemovalFriend.friendshipId);
  }

  function handleInvite(friend: FriendEntry) {
    const friendId = String(friend.userId);
    const friendName = friend.username;
    if (!socket?.connected) return;

    const pendingInvite = outgoingInvites[friendId];
    const presenceStatus: PresenceStatus = friend.presence?.status ?? "offline";

    if (!pendingInvite && presenceStatus !== "online") {
      toast.message("Player is unavailable for invites right now.");
      return;
    }

    setActionMessage(null);

    if (pendingInvite) {
      socket.emit(
        "cancelGameInvite",
        { friendId },
        (response: { status?: string; message?: string }) => {
          if (response?.status === "ok") {
            clearOutgoingInvite(friendId);
            toast.message(`Invite cancelled for ${friendName}.`);
            return;
          }
          toast.error(response?.message ?? "Could not cancel invite.");
        },
      );
      return;
    }

    setInviteModalFriend(friend);
  }

  const sendConfiguredInvite = (friend: FriendEntry, config: RoomConfig) => {
    setInviteModalFriend(null);
    if (!socket?.connected) return;
    
    socket.emit(
      "sendGameInvite",
      { friendId: friend.userId, config },
      (response: { status?: string; roomCode?: string; message?: string }) => {
        if (response?.status === "success" && response.roomCode) {
          setOutgoingInvite({
            friendId: friend.userId,
            roomCode: response.roomCode,
            status: "pending",
            expiresAt: Date.now() + 60_000,
          });
          setActionMessage(`Invited ${friend.username} to a private room.`);
          toast.success(`Invite sent to ${friend.username}.`);
          return;
        }
        const message = response?.message ?? "Could not create invite.";
        setActionMessage(message);
        toast.error(message);
      },
    );
  };

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center px-6">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400/30 border-t-sky-400" />
      </div>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-100 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
          <p className="text-sm text-slate-300">You need to log in first.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-3 text-sm font-bold text-white hover:brightness-110 transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020617] text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_50%_at_50%_-10%,rgba(14,165,233,0.2),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(168,85,247,0.15),transparent_55%)]" />
      </div>

      <main className="relative mx-auto w-full max-w-7xl px-5 py-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300">
              Friends
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white">
              Your squad
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Search by UUID or username, track live presence, and send private
              room invites.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/lobby"
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
            >
              Back to Lobby
            </Link>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_90px_rgba(15,23,42,0.24)] backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-sky-300" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                  Add Friend
                </h2>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void handleAddFriend();
                  }}
                  placeholder="Username or UUID"
                  className="flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/10"
                />
                <button
                  onClick={handleAddFriend}
                  disabled={
                    submitting || !identifier.trim() || !socket?.connected
                  }
                  className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-600 to-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Sending…" : "Send Request"}
                </button>
              </div>
              {actionMessage && (
                <p className="mt-3 text-sm text-slate-300">{actionMessage}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <MetricCard
                label="Friends"
                value={String(friends.length)}
                icon={<Users className="h-4 w-4" />}
              />
              <MetricCard
                label="Incoming"
                value={String(incomingRequests.length)}
                icon={<UserRound className="h-4 w-4" />}
              />
              <MetricCard
                label="Outgoing"
                value={String(outgoingRequests.length)}
                icon={<Swords className="h-4 w-4" />}
              />
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Friends</h2>
                  <p className="text-sm text-slate-400">
                    Live presence syncs from Redis every few seconds.
                  </p>
                </div>
                <button
                  onClick={() => void fetchFriends().then(setFriendsData)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-20 animate-pulse rounded-2xl bg-white/[0.05]"
                    />
                  ))
                ) : friends.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-slate-500">
                    No friends yet. Send a request to start building your squad.
                  </div>
                ) : (
                  friends.map((friend) => (
                    <FriendRow
                      key={friend.friendshipId}
                      friend={friend}
                      invitePending={Boolean(outgoingInvites[friend.userId])}
                      onInvite={() => handleInvite(friend)}
                      onRemoveFriend={() =>
                        openRemoveFriendConfirmation(friend)
                      }
                    />
                  ))
                )}
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white">
                Incoming requests
              </h2>
              <div className="mt-4 space-y-3">
                {incomingRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">No pending requests.</p>
                ) : (
                  incomingRequests.map((request) => (
                    <RequestRow
                      key={request.friendshipId}
                      request={request}
                      onAccept={() => void handleAccept(request.friendshipId)}
                      onReject={() => void handleReject(request.friendshipId)}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white">
                Outgoing requests
              </h2>
              <div className="mt-4 space-y-3">
                {outgoingRequests.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No outgoing requests.
                  </p>
                ) : (
                  outgoingRequests.map((request) => (
                    <div
                      key={request.friendshipId}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <p className="text-sm font-semibold text-white">
                        {request.username}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Waiting for response
                      </p>
                      <div className="mt-3">
                        <button
                          onClick={() =>
                            void handleCancelOutgoing(request.friendshipId)
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
                        >
                          Cancel Request
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-white">Presence legend</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <LegendRow dot="bg-emerald-400" label="Online" />
                <LegendRow dot="bg-violet-400" label="In-Game" />
                <LegendRow dot="bg-slate-500" label="Offline" />
              </div>
            </div>
          </aside>
        </div>
      </main>

      <ConfirmModal
        isOpen={!!pendingRemovalFriend}
        onClose={() => setPendingRemovalFriend(null)}
        title="Remove friend?"
        message={`Are you sure you want to remove ${pendingRemovalFriend?.username} from your friends list?`}
        onConfirm={() => void confirmRemoveFriend()}
        confirmText="Remove"
        isDestructive={true}
        isLoading={isRemovingFriend}
      />

      {inviteModalFriend && (
        <RoomConfigModal
          isOpen={!!inviteModalFriend}
          onClose={() => setInviteModalFriend(null)}
          onConfirm={(config) => sendConfiguredInvite(inviteModalFriend, config)}
          friendName={inviteModalFriend.username}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-slate-200">
        {icon}
      </div>
      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function FriendRow({
  friend,
  onInvite,
  onRemoveFriend,
  invitePending,
}: {
  friend: FriendEntry;
  onInvite: () => void;
  onRemoveFriend: () => void;
  invitePending: boolean;
}) {
  const presenceStatus = friend.presence?.status ?? "offline";
  const canStartInvite = presenceStatus === "online";
  const inviteDisabled = !canStartInvite;
  const inviteTitle =
    invitePending || canStartInvite
      ? undefined
      : "Player must be online to receive invites.";

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4 transition hover:border-white/15 hover:bg-black/30">
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${statusClass(presenceStatus)}`}
          />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-white">
                {friend.username}
              </p>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {statusLabel(presenceStatus)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">UUID: {friend.userId}</p>
          </div>
        </div>

        <div className="flex flex-nowrap gap-2 sm:justify-end">
          <Link
            href={`/profile/${friend.userId}`}
            className="whitespace-nowrap rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            View Profile
          </Link>
          <button
            onClick={onInvite}
            disabled={inviteDisabled}
            title={inviteTitle}
            className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-white transition ${
              invitePending
                ? "bg-red-500 hover:bg-red-400"
                : "bg-gradient-to-r from-sky-600 to-violet-600 hover:brightness-110"
            } ${inviteDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {invitePending ? "Cancel Invite" : "Invite to Game"}
          </button>
          <button
            onClick={onRemoveFriend}
            className="whitespace-nowrap rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/20"
          >
            Remove Friend
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestRow({
  request,
  onAccept,
  onReject,
}: {
  request: FriendEntry;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{request.username}</p>
          <p className="mt-1 text-xs text-slate-500">Friend request received</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] hover:text-white transition"
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className="rounded-xl bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

function LegendRow({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`h-3 w-3 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
