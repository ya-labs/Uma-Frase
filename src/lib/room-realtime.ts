import type { SupabaseClient } from "@supabase/supabase-js";

import { roomStateChangedEventSchema } from "@/domain";

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

export function createRoomRealtime(client?: RealtimeClient): RoomRealtime {
  return {
    subscribe(roomCode, onRoomChanged, onStatusChanged) {
      const activeClient = client ?? getSupabaseBrowserClient();
      onStatusChanged("connecting");

      const channel = activeClient
        .channel(`room:${roomCode}`)
        .on("broadcast", { event: "room_state_changed" }, ({ payload }) => {
          const event = roomStateChangedEventSchema.safeParse(payload);

          if (event.success && event.data.roomCode === roomCode) {
            onRoomChanged();
          }
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            onStatusChanged("connected");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            onStatusChanged("reconnecting");
          } else if (status === "CLOSED") {
            onStatusChanged("disconnected");
          }
        });

      return () => {
        onStatusChanged("disconnected");
        void activeClient.removeChannel(channel);
      };
    },
  };
}
