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

    // If we already have a socket and it's connected, do nothing
    if (currentSocket?.connected) {
      set({ isConnected: true });
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
