"use client";

import { use } from "react";
import { LobbyRoom } from "@/components/lobby-room";

export default function RoomPage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params);

  return <LobbyRoom roomCode={roomCode} />;
}
