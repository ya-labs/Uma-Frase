"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { createRoomClient, type RoomClient } from "@/lib/room-client";
import {
  createRoomSessionStore,
  type RoomSessionStore,
} from "@/lib/room-session";

import { RoomAccess, type RoomAccessOperations } from "./room-access";

type RoomAccessContainerProps = {
  client?: Pick<RoomClient, "createRoom" | "joinRoom">;
  sessions?: RoomSessionStore;
  navigateToRoom?: (roomCode: string) => void;
};

export function RoomAccessContainer({
  client: providedClient,
  sessions: providedSessions,
  navigateToRoom,
}: RoomAccessContainerProps) {
  const router = useRouter();
  const client = useMemo(
    () => providedClient ?? createRoomClient(),
    [providedClient],
  );
  const sessions = useMemo(
    () => providedSessions ?? createRoomSessionStore(),
    [providedSessions],
  );

  const operations = useMemo<RoomAccessOperations>(() => {
    function enterRoom(roomCode: string) {
      if (navigateToRoom) {
        navigateToRoom(roomCode);
      } else {
        router.push(`/room/${encodeURIComponent(roomCode)}`);
      }
    }

    return {
      async createRoom(command) {
        const session = await client.createRoom(command);
        const roomCode = session.state.public.game.code;
        sessions.savePlayerToken(roomCode, session.playerToken);
        enterRoom(roomCode);
      },

      async joinRoom(command) {
        const session = await client.joinRoom(command);
        const roomCode = session.state.public.game.code;
        sessions.savePlayerToken(roomCode, session.playerToken);
        enterRoom(roomCode);
      },
    };
  }, [client, navigateToRoom, router, sessions]);

  return <RoomAccess operations={operations} />;
}
