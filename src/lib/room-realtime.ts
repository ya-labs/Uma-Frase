"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { roomRealtimeEventSchema } from "@/domain/contracts";

import { getSupabaseBrowserClient } from "./supabase-browser";

export type RoomConnectionStatus =
  "connecting" | "connected" | "reconnecting" | "disconnected";

export type RoomRealtime = {
  subscribe(
    roomCode: string,
    onRoomChanged: () => void,
    onStatusChanged: (status: RoomConnectionStatus) => void,
  ): () => void;
};

type RealtimeClient = Pick<SupabaseClient, "channel" | "removeChannel">;

function subscribe(
  roomCode: string,
  onChange: () => void,
  client: RealtimeClient,
  onStatusChanged?: (status: RoomConnectionStatus) => void,
): () => void {
  const normalizedCode = roomCode.trim().toUpperCase();
  let active = true;

  onStatusChanged?.("connecting");

  const channel = client
    .channel(`room:${normalizedCode}`)
    .on("broadcast", { event: "room_state_changed" }, ({ payload }) => {
      const event = roomRealtimeEventSchema.safeParse(payload);

      if (
        active &&
        event.success &&
        event.data.roomCode.trim().toUpperCase() === normalizedCode
      ) {
        onChange();
      }
    })
    .subscribe((status) => {
      if (!active) return;

      if (status === "SUBSCRIBED") {
        onStatusChanged?.("connected");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onStatusChanged?.("reconnecting");
      } else if (status === "CLOSED") {
        onStatusChanged?.("disconnected");
      }
    });

  return () => {
    if (!active) return;
    active = false;
    onStatusChanged?.("disconnected");
    void client.removeChannel(channel);
  };
}

export function subscribeToRoomChanges(
  roomCode: string,
  onChange: () => void,
  client: RealtimeClient = getSupabaseBrowserClient(),
): () => void {
  return subscribe(roomCode, onChange, client);
}

export function createRoomRealtime(client?: RealtimeClient): RoomRealtime {
  return {
    subscribe(roomCode, onRoomChanged, onStatusChanged) {
      return subscribe(
        roomCode,
        onRoomChanged,
        client ?? getSupabaseBrowserClient(),
        onStatusChanged,
      );
    },
  };
}
