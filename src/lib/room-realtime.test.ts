import { describe, expect, it, vi } from "vitest";

import { createRoomRealtime } from "./room-realtime";

describe("sincronização Realtime da sala", () => {
  it("usa a notificação apenas para solicitar uma nova leitura e limpa o canal", () => {
    let broadcast: ((message: { payload: unknown }) => void) | undefined;
    let subscriptionStatus: ((status: string) => void) | undefined;
    const channel = {
      on: vi.fn(
        (
          _type: string,
          _filter: unknown,
          callback: (message: { payload: unknown }) => void,
        ) => {
          broadcast = callback;
          return channel;
        },
      ),
      subscribe: vi.fn((callback: (status: string) => void) => {
        subscriptionStatus = callback;
        return channel;
      }),
    };
    const client = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn().mockResolvedValue("ok"),
    };
    const onRoomChanged = vi.fn();
    const onStatusChanged = vi.fn();
    const realtime = createRoomRealtime(client as never);

    const unsubscribe = realtime.subscribe(
      "ABC123",
      onRoomChanged,
      onStatusChanged,
    );
    subscriptionStatus?.("SUBSCRIBED");
    broadcast?.({
      payload: { type: "room_state_changed", roomCode: "ABC123" },
    });
    broadcast?.({
      payload: { type: "room_state_changed", roomCode: "OTHER" },
    });

    expect(onRoomChanged).toHaveBeenCalledTimes(1);
    expect(onStatusChanged).toHaveBeenCalledWith("connected");

    subscriptionStatus?.("CHANNEL_ERROR");
    expect(onStatusChanged).toHaveBeenCalledWith("reconnecting");

    unsubscribe();
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
