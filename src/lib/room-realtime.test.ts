import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { subscribeToRoomChanges } from "./room-realtime";

describe("notificações Realtime da sala", () => {
  it("notifica a aplicação apenas para um evento válido da própria sala", () => {
    const onChange = vi.fn();
    let receive: ((event: { payload: unknown }) => void) | undefined;
    const channel = {
      on: vi.fn((_type: string, _filter: unknown, callback: typeof receive) => {
        receive = callback;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn().mockResolvedValue("ok"),
    } as unknown as SupabaseClient;

    const unsubscribe = subscribeToRoomChanges(" room1234 ", onChange, client);

    receive?.({
      payload: { type: "room_state_changed", roomCode: "ROOM1234" },
    });
    receive?.({
      payload: {
        type: "room_state_changed",
        roomCode: "OTHER123",
        privateAnswer: "não deve ser aceito pelo contrato estrito",
      },
    });

    expect(client.channel).toHaveBeenCalledWith("room:ROOM1234");
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
