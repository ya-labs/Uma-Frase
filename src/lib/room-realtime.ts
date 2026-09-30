"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { roomStateChangedEventSchema } from "@/domain/contracts";

import { getSupabaseBrowserClient } from "./supabase-browser";

export type RoomConnectionStatus =
  "connecting" | "connected" | "reconnecting" | "disconnected";

export type RoomRefreshReason = "broadcast" | "subscribed";

export type RoomRealtime = {
  subscribe(
    roomCode: string,
    onRoomChanged: (reason: RoomRefreshReason) => void,
    onStatusChanged: (status: RoomConnectionStatus) => void,
  ): () => void;
};

type RealtimeClient = Pick<SupabaseClient, "channel" | "removeChannel">;

// Database broadcasts include the message id added by Supabase Realtime.
const databaseBroadcastSchema = roomStateChangedEventSchema.extend({
  id: z.string().min(1),
});

function subscribe(
  roomCode: string,
  onChange: (reason: RoomRefreshReason) => void,
  client: RealtimeClient,
  onStatusChanged?: (status: RoomConnectionStatus) => void,
): () => void {
  const normalizedCode = roomCode.trim().toUpperCase();
  let active = true;

  onStatusChanged?.("connecting");

  const channel = client
    .channel(`room:${normalizedCode}`)
    .on("broadcast", { event: "room_state_changed" }, ({ payload }) => {
      const event = databaseBroadcastSchema.safeParse(payload);

      if (
        active &&
        event.success &&
        event.data.roomCode.trim().toUpperCase() === normalizedCode
      ) {
        onChange("broadcast");
      }
    })
    .subscribe((status) => {
      if (!active) return;

      if (status === "SUBSCRIBED") {
        onStatusChanged?.("connected");
        // A change may have happened before the channel finished subscribing.
        onChange("subscribed");
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
