import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RoomState } from "@/domain";
import { roomStateFixture } from "@/domain/contracts/fixtures";
import { RoomClientError, type RoomClient } from "@/lib/room-client";
import type { RoomRealtime } from "@/lib/room-realtime";
import type { RoomSessionStore } from "@/lib/room-session";

import { LobbyContainer } from "./lobby-container";

afterEach(cleanup);

function waitingState({
  isHost = true,
  playerCount = 2,
}: { isHost?: boolean; playerCount?: 1 | 2 } = {}): RoomState {
  return {
    public: {
      game: {
        ...roomStateFixture.public.game,
        status: "waiting",
        round: 0,
      },
      players: roomStateFixture.public.players
        .slice(0, playerCount)
        .map((player) => ({
          ...player,
          hasAnswered: false,
        })),
      currentRound: null,
    },
    private: {
      playerId: isHost ? "player-1" : "player-2",
      isHost,
      answer: null,
    },
  };
}

function sessions(playerToken = "opaque-token"): RoomSessionStore {
  return {
    getPlayerToken: vi.fn(() => playerToken || null),
    savePlayerToken: vi.fn(),
    removePlayerToken: vi.fn(),
  };
}

function realtimeHarness() {
  const roomChangedCallbacks = new Set<(reason: "broadcast") => void>();
  const unsubscribe = vi.fn();
  const realtime: RoomRealtime = {
    subscribe: vi.fn((_roomCode, onRoomChanged, onStatusChanged) => {
      roomChangedCallbacks.add(onRoomChanged);
      onStatusChanged("connected");
      return () => {
        roomChangedCallbacks.delete(onRoomChanged);
        unsubscribe();
      };
    }),
  };

  return {
    realtime,
    unsubscribe,
    notify() {
      roomChangedCallbacks.forEach((callback) => callback("broadcast"));
    },
  };
}

describe("lobby sincronizado", () => {
  it("reconsulta o estado após uma notificação e remove a inscrição ao sair", async () => {
    const firstState = waitingState({ playerCount: 1 });
    const convergedState = waitingState({ playerCount: 2 });
    const client = {
      getRoomState: vi
        .fn()
        .mockResolvedValueOnce({ state: firstState })
        .mockResolvedValueOnce({ state: convergedState }),
      startRoom: vi.fn(),
    } satisfies Pick<RoomClient, "getRoomState" | "startRoom">;
    const roomRealtime = realtimeHarness();
    const view = render(
      <LobbyContainer
        roomCode="ABC123"
        client={client}
        realtime={roomRealtime.realtime}
        sessions={sessions()}
      />,
    );

    expect(await screen.findByText("Aguardando jogador")).toBeDefined();

    act(() => roomRealtime.notify());

    expect(await screen.findByText("Bruno")).toBeDefined();
    expect(client.getRoomState).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Avisos recebidos: 1/)).toBeDefined();
    expect(screen.getByText(/Última leitura: (?!aguardando)/)).toBeDefined();

    view.unmount();
    expect(roomRealtime.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("faz duas instâncias convergirem para o mesmo estado público", async () => {
    let serverState = waitingState({ playerCount: 1 });
    const client = {
      getRoomState: vi.fn(async () => ({ state: serverState })),
      startRoom: vi.fn(),
    } satisfies Pick<RoomClient, "getRoomState" | "startRoom">;
    const roomRealtime = realtimeHarness();

    render(
      <>
        <LobbyContainer
          roomCode="ABC123"
          client={client}
          realtime={roomRealtime.realtime}
          sessions={sessions("token-one")}
        />
        <LobbyContainer
          roomCode="ABC123"
          client={client}
          realtime={roomRealtime.realtime}
          sessions={sessions("token-two")}
        />
      </>,
    );

    expect(await screen.findAllByText("Aguardando jogador")).toHaveLength(2);

    serverState = waitingState({ playerCount: 2 });
    act(() => roomRealtime.notify());

    expect(await screen.findAllByText("Bruno")).toHaveLength(2);
    expect(client.getRoomState).toHaveBeenCalledTimes(4);
  });

  it("mostra a partida iniciada somente após a confirmação do servidor", async () => {
    let confirmStart: ((result: { state: RoomState }) => void) | undefined;
    const confirmedState: RoomState = {
      ...waitingState(),
      public: {
        ...waitingState().public,
        game: { ...waitingState().public.game, status: "generating" },
      },
    };
    const startRequest = new Promise<{ state: RoomState }>((resolve) => {
      confirmStart = resolve;
    });
    const client = {
      getRoomState: vi.fn().mockResolvedValue({ state: waitingState() }),
      startRoom: vi.fn().mockReturnValue(startRequest),
    } satisfies Pick<RoomClient, "getRoomState" | "startRoom">;

    render(
      <LobbyContainer
        roomCode="ABC123"
        client={client}
        realtime={realtimeHarness().realtime}
        sessions={sessions()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /iniciar partida/i }),
    );

    expect(screen.getByRole("button", { name: /iniciando/i })).toBeDefined();
    expect(screen.queryByText("Partida iniciada.")).toBeNull();

    await act(async () => {
      confirmStart?.({ state: confirmedState });
      await startRequest;
    });

    expect(await screen.findByText("Partida iniciada.")).toBeDefined();
  });

  it("não oferece a ação de início ao convidado", async () => {
    const client = {
      getRoomState: vi.fn().mockResolvedValue({
        state: waitingState({ isHost: false }),
      }),
      startRoom: vi.fn(),
    } satisfies Pick<RoomClient, "getRoomState" | "startRoom">;

    render(
      <LobbyContainer
        roomCode="ABC123"
        client={client}
        realtime={realtimeHarness().realtime}
        sessions={sessions()}
      />,
    );

    expect(
      await screen.findByText(/aguardando o host solicitar/i),
    ).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /iniciar partida/i }),
    ).toBeNull();
  });

  it("permite recuperar uma falha ao consultar o estado público", async () => {
    const client = {
      getRoomState: vi
        .fn()
        .mockRejectedValueOnce(
          new RoomClientError(
            "network",
            "Não foi possível conectar à sala. Verifique sua conexão e tente novamente.",
            true,
          ),
        )
        .mockResolvedValueOnce({ state: waitingState() }),
      startRoom: vi.fn(),
    } satisfies Pick<RoomClient, "getRoomState" | "startRoom">;

    render(
      <LobbyContainer
        roomCode="ABC123"
        client={client}
        realtime={realtimeHarness().realtime}
        sessions={sessions()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Não foi possível conectar à sala. Verifique sua conexão e tente novamente.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ana")).toBeDefined();
  });

  it("informa quando a identidade não pertence à aba atual", async () => {
    const client = {
      getRoomState: vi.fn(),
      startRoom: vi.fn(),
    } satisfies Pick<RoomClient, "getRoomState" | "startRoom">;
    const roomRealtime = realtimeHarness();

    render(
      <LobbyContainer
        roomCode="ABC123"
        client={client}
        realtime={roomRealtime.realtime}
        sessions={sessions("")}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Sua identificação desta sala não está disponível nesta aba.",
    );
    expect(client.getRoomState).not.toHaveBeenCalled();
    expect(roomRealtime.realtime.subscribe).not.toHaveBeenCalled();
  });
});
