"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { roomRealtimeEventSchema } from "@/domain/contracts";

import { getSupabaseBrowserClient } from "./supabase-browser";

export function subscribeToRoomChanges(
  roomCode: string,
  onChange: () => void,
  client: SupabaseClient = getSupabaseBrowserClient(),
): () => void {
  const normalizedCode = roomCode.trim().toUpperCase();
  const channel = client
    .channel(`room:${normalizedCode}`)
    .on("broadcast", { event: "room_state_changed" }, ({ payload }) => {
      const event = roomRealtimeEventSchema.safeParse(payload);

      if (
        event.success &&
        event.data.roomCode.trim().toUpperCase() === normalizedCode
      ) {
        onChange();
      }
    })
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
