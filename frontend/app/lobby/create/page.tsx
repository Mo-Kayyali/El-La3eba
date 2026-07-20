"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RoomConfigModal, RoomConfig } from "@/components/room-config-modal";
import { useSocketStore } from "@/src/store/socketStore";
import { useAuthStore } from "@/lib/auth-store";
import { useLobbyStore } from "@/src/store/lobbyStore";

export default function CreateLobbyPage() {
  const router = useRouter();
  const socket = useSocketStore((s) => s.socket);
  const { bootstrapped, isAuthenticated, accessToken } = useAuthStore();
  const setLobbyData = useLobbyStore((s) => s.setLobbyData);
  
  const [isCreating, setIsCreating] = useState(false);

  if (!bootstrapped) return null;
  if (!isAuthenticated || !accessToken) {
    router.replace("/");
    return null;
  }

  const handleConfirm = (config: RoomConfig) => {
    if (!socket?.connected) {
      toast.error("Not connected to server.");
      return;
    }

    setIsCreating(true);
    socket.emit("createLobby", { config }, (response: { status?: string; roomCode?: string; roomData?: any; message?: string }) => {
      setIsCreating(false);
      if (response?.status === "success" && response.roomCode) {
        setLobbyData(response.roomData);
        router.replace(`/lobby/room/${response.roomCode}`);
      } else {
        toast.error(response?.message ?? "Failed to create lobby.");
      }
    });
  };

  const handleClose = () => {
    if (!isCreating) {
      router.replace("/lobby");
    }
  };

  return (
    <div className="min-h-screen bg-[#030712]">
      <RoomConfigModal
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
