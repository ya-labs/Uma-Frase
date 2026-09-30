import { describe, expect, it, vi } from "vitest";

import { createRoomRealtime, subscribeToRoomChanges } from "./room-realtime";

function controlledRealtimeClient() {
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

  return {
    client,
    channel,
    receive: (payload: unknown) => broadcast?.({ payload }),
    status: (value: string) => subscriptionStatus?.(value),
  };
}

describe("sincronização Realtime da sala", () => {
  it("usa notificações válidas somente para solicitar uma nova leitura", () => {
    const realtimeClient = controlledRealtimeClient();
    const onRoomChanged = vi.fn();
    const onStatusChanged = vi.fn();
    const realtime = createRoomRealtime(realtimeClient.client as never);

    const unsubscribe = realtime.subscribe(
      " abcd2345 ",
      onRoomChanged,
      onStatusChanged,
    );
    realtimeClient.status("SUBSCRIBED");
    realtimeClient.receive({
      type: "room_state_changed",
      roomCode: "ABCD2345",
    });
    realtimeClient.receive({
      type: "room_state_changed",
      roomCode: "OTHER123",
    });
    realtimeClient.receive({
      type: "room_state_changed",
      roomCode: "ABCD2345",
      privateAnswer: "payload não faz parte do contrato",
    });

    expect(realtimeClient.client.channel).toHaveBeenCalledWith("room:ABCD2345");
    expect(onRoomChanged).toHaveBeenCalledTimes(1);
    expect(onStatusChanged).toHaveBeenCalledWith("connecting");
    expect(onStatusChanged).toHaveBeenCalledWith("connected");

    realtimeClient.status("CHANNEL_ERROR");
    expect(onStatusChanged).toHaveBeenCalledWith("reconnecting");

    unsubscribe();
    unsubscribe();
    realtimeClient.receive({
      type: "room_state_changed",
      roomCode: "ABCD2345",
    });
    expect(onRoomChanged).toHaveBeenCalledTimes(1);
    expect(onStatusChanged).toHaveBeenLastCalledWith("disconnected");
    expect(realtimeClient.client.removeChannel).toHaveBeenCalledOnce();
    expect(realtimeClient.client.removeChannel).toHaveBeenCalledWith(
      realtimeClient.channel,
    );
  });

  it("mantém a API simples de inscrição com o mesmo canal e limpeza", () => {
    const realtimeClient = controlledRealtimeClient();
    const onChange = vi.fn();

    const unsubscribe = subscribeToRoomChanges(
      " room1234 ",
      onChange,
      realtimeClient.client as never,
    );

    realtimeClient.receive({
      type: "room_state_changed",
      roomCode: "ROOM1234",
    });

    expect(realtimeClient.client.channel).toHaveBeenCalledWith("room:ROOM1234");
    expect(onChange).toHaveBeenCalledOnce();

    unsubscribe();
    expect(realtimeClient.client.removeChannel).toHaveBeenCalledWith(
      realtimeClient.channel,
    );
  });
});
