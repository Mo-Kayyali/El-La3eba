import { useState, useEffect, useCallback } from "react";
import { useSocketStore } from "@/src/store/socketStore";
import { useAuthStore } from "@/lib/auth-store";
import { useNotificationStore } from "@/src/store/notificationStore";
import { fetchFriends, FriendsResponse, FriendPresence } from "@/lib/api";

export function useFriendsList() {
  const { bootstrapped, isAuthenticated, accessToken } = useAuthStore();
  const socket = useSocketStore((s) => s.socket);
  const setPendingFriendRequests = useNotificationStore(
    (s) => s.setPendingFriendRequests,
  );

  const [friendsData, setFriendsData] = useState<FriendsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadFriends = useCallback(async () => {
    if (!bootstrapped || !isAuthenticated || !accessToken) return;
    
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
  }, [bootstrapped, isAuthenticated, accessToken, setPendingFriendRequests]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

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

  return {
    friendsData,
    loading,
    refresh: loadFriends,
    setFriendsData,
  };
}
