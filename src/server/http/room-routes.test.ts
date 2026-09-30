import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_ROUNDS } from "@/domain/game";

import type { RoomServicePort } from "./room-routes";
import {
  handleCreateRoom,
  handleGetRoomState,
  handleJoinRoom,
  handleStartRoom,
} from "./room-routes";

const state = {
  public: {
    game: {
      id: "game-1",
      code: "ABCD2345",
      status: "waiting" as const,
      round: 0,
      maxRounds: MAX_ROUNDS,
      pausedFrom: null,
    },
    players: [
      {
        id: "player-1",
        name: "Ana",
        score: 0,
        isConnected: true,
        hasAnswered: false,
      },
    ],
    currentRound: null,
  },
  private: { playerId: "player-1", isHost: true, answer: null },
};

function service(): RoomServicePort {
  return {
    create: vi.fn().mockResolvedValue({
      playerToken: "opaque-token-with-at-least-32-chars",
      state,
    }),
    join: vi.fn().mockResolvedValue({
      playerToken: "opaque-token-with-at-least-32-chars",
      state,
    }),
    getState: vi.fn().mockResolvedValue(state),
    start: vi.fn().mockResolvedValue(state),
    setPresence: vi.fn().mockResolvedValue(state),
  };
}

const context = { params: Promise.resolve({ code: "abcd2345" }) };

describe("rotas de salas", () => {
  it("cria uma sala e retorna a identidade somente ao chamador", async () => {
    const roomService = service();
    const response = await handleCreateRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        body: JSON.stringify({ playerName: "Ana" }),
      }),
      roomService,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { playerToken: "opaque-token-with-at-least-32-chars" },
    });
  });

  it("aceita a identidade opaca criada pela aba ao criar a sala", async () => {
    const roomService = service();
    const response = await handleCreateRoom(
      new Request("http://localhost/api/rooms", {
        method: "POST",
        headers: {
          authorization: "Bearer opaque-token-with-at-least-32-chars",
        },
        body: JSON.stringify({ playerName: "Ana" }),
      }),
      roomService,
    );

    expect(response.status).toBe(201);
    expect(roomService.create).toHaveBeenCalledWith({
      playerName: "Ana",
      playerToken: "opaque-token-with-at-least-32-chars",
    });
  });

  it("usa o código da URL ao entrar na sala", async () => {
    const roomService = service();
    const response = await handleJoinRoom(
      new Request("http://localhost/api/rooms/abcd2345/join", {
        method: "POST",
        body: JSON.stringify({ playerName: "Beto" }),
      }),
      context,
      roomService,
    );

    expect(response.status).toBe(200);
    expect(roomService.join).toHaveBeenCalledWith({
      roomCode: "ABCD2345",
      playerName: "Beto",
    });
  });

  it("exige identidade para consultar o estado", async () => {
    const roomService = service();
    const response = await handleGetRoomState(
      new Request("http://localhost/api/rooms/abcd2345/state"),
      context,
      roomService,
    );

    expect(response.status).toBe(400);
    expect(roomService.getState).not.toHaveBeenCalled();
  });

  it("aceita a identidade pelo cabeçalho Bearer", async () => {
    const roomService = service();
    const request = new Request("http://localhost/api/rooms/abcd2345/start", {
      method: "POST",
      headers: {
        authorization: "Bearer opaque-token-with-at-least-32-chars",
      },
      body: JSON.stringify({}),
    });
    const response = await handleStartRoom(request, context, roomService);

    expect(response.status).toBe(200);
    expect(roomService.start).toHaveBeenCalledWith({
      roomCode: "ABCD2345",
      playerToken: "opaque-token-with-at-least-32-chars",
    });
  });
});
