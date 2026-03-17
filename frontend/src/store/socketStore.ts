import { create } from "zustand";
import { io, Socket } from "socket.io-client";

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connectSocket: (token: string) => void;
  disconnectSocket: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,

  connectSocket: (token) => {
    const currentSocket = get().socket;

    // React Strict Mode (dev) runs effects twice. Guard hard against creating
    // duplicate sockets: if we already have one, reuse it.
    if (currentSocket) {
      // Keep auth token up-to-date for reconnects.
      (currentSocket as unknown as { auth?: unknown }).auth = { token };

      if (currentSocket.connected) {
        set({ isConnected: true });
        return;
      }

      // If it's already in the process of connecting/reconnecting, do nothing.
      if ((currentSocket as unknown as { active?: boolean }).active) return;

      // Otherwise, attempt to reconnect without recreating the instance.
      try {
        currentSocket.connect();
      } catch {
        // If connect() throws for any reason, fall through and recreate below.
      }
      return;
    }

    // Initialize the socket
    const socket = io("http://localhost:3000", {
      auth: { token },
      autoConnect: true,
    });

    // Listeners to update our global state
    socket.on("connect", () => {
      console.log("✅ Socket fully connected!");
      set({ isConnected: true });
    });

    socket.on("disconnect", () => {
      console.log("⚠️ Socket disconnected!");
      set({ isConnected: false });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  },
}));
