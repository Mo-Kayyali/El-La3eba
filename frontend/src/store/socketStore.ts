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

      // Attempt to reconnect first, then recreate only if that fails.
      try {
        currentSocket.connect();
        return;
      } catch {
        currentSocket.disconnect();
        set({ socket: null, isConnected: false });
      }
    }

    // Initialize the socket
    const socket = io("http://localhost:3000", {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
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

    socket.io.on("reconnect", () => {
      set({ isConnected: true });
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
