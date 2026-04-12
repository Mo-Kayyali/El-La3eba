import { create } from "zustand";

type InviteStatus = "pending";

export type IncomingGameInvite = {
  inviterId: string;
  inviterUsername: string;
  roomCode: string;
  expiresAt: number;
};

type OutgoingInvite = {
  friendId: string;
  roomCode: string;
  status: InviteStatus;
  expiresAt: number;
};

type NotificationState = {
  pendingFriendRequests: number;
  incomingGameInvites: IncomingGameInvite[];
  outgoingInvites: Record<string, OutgoingInvite>;
  incrementFriendRequests: () => void;
  setPendingFriendRequests: (count: number) => void;
  addIncomingGameInvite: (invite: IncomingGameInvite) => void;
  removeIncomingGameInvite: (inviterId: string) => void;
  clearIncomingGameInvites: () => void;
  setOutgoingInvite: (invite: OutgoingInvite) => void;
  clearOutgoingInvite: (friendId: string) => void;
  pruneExpiredInvites: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  pendingFriendRequests: 0,
  incomingGameInvites: [],
  outgoingInvites: {},

  incrementFriendRequests: () =>
    set((state) => ({
      pendingFriendRequests: state.pendingFriendRequests + 1,
    })),

  setPendingFriendRequests: (count) =>
    set({ pendingFriendRequests: Math.max(0, count) }),

  addIncomingGameInvite: (invite) =>
    set((state) => {
      const exists = state.incomingGameInvites.some(
        (entry) => entry.inviterId === invite.inviterId,
      );
      if (exists) {
        return {
          incomingGameInvites: state.incomingGameInvites.map((entry) =>
            entry.inviterId === invite.inviterId ? invite : entry,
          ),
        };
      }

      return {
        incomingGameInvites: [invite, ...state.incomingGameInvites],
      };
    }),

  removeIncomingGameInvite: (inviterId) =>
    set((state) => ({
      incomingGameInvites: state.incomingGameInvites.filter(
        (invite) => invite.inviterId !== inviterId,
      ),
    })),

  clearIncomingGameInvites: () => set({ incomingGameInvites: [] }),

  setOutgoingInvite: (invite) =>
    set((state) => ({
      outgoingInvites: {
        ...state.outgoingInvites,
        [invite.friendId]: invite,
      },
    })),

  clearOutgoingInvite: (friendId) =>
    set((state) => {
      const next = { ...state.outgoingInvites };
      delete next[friendId];
      return { outgoingInvites: next };
    }),

  pruneExpiredInvites: () =>
    set((state) => {
      const now = Date.now();

      const incomingGameInvites = state.incomingGameInvites.filter(
        (invite) => invite.expiresAt > now,
      );

      const outgoingInvites = Object.fromEntries(
        Object.entries(state.outgoingInvites).filter(
          ([, invite]) => invite.expiresAt > now,
        ),
      );

      return { incomingGameInvites, outgoingInvites };
    }),
}));
