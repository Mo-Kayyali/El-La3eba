import { create } from "zustand";

interface LobbyStateData {
  hostId: string;
  hostUsername: string;
  guestId: string | null;
  guestUsername: string | null;
  config: { composition: string[]; timerConfig: Record<string, number> };
  hostReady: boolean;
  guestReady: boolean;
  status: string;
}

interface LobbyStoreState {
  lobbyData: LobbyStateData | null;
  setLobbyData: (data: LobbyStateData | null) => void;
}

export const useLobbyStore = create<LobbyStoreState>((set) => ({
  lobbyData: null,
  setLobbyData: (data) => set({ lobbyData: data }),
}));
