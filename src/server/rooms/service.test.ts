import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_ROUNDS } from "@/domain/game";

import { hashPlayerToken } from "./identity";
import type { RoomRepository, RoomSnapshot } from "./repository";
import { RoomService } from "./service";

function waitingSnapshot(playerId = "host-1"): RoomSnapshot {
  return {
    playerId,
    state: {
      game: {
        id: "game-1",
        code: "ROOM1234",
        status: "waiting",
        hostPlayerId: "host-1",
        round: 0,
        maxRounds: MAX_ROUNDS,
        storySummary: "",
        pausedFrom: null,
        createdAt: "2026-09-30T12:00:00.000Z",
      },
      players: [
        {
          id: "host-1",
          gameId: "game-1",
          name: "Ana",
          score: 0,
          isConnected: true,
        },
      ],
      currentRound: null,
      answers: [],
    },
  };
}

function repository(): RoomRepository {
  return {
    createRoom: vi.fn().mockResolvedValue("ROOM1234"),
    joinRoom: vi.fn().mockResolvedValue(undefined),
    startRoom: vi.fn().mockResolvedValue(undefined),
    setPresence: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn().mockResolvedValue(waitingSnapshot()),
  };
}

describe("serviço de salas", () => {
  it("envia somente o hash do token ao repositório", async () => {
    const roomRepository = repository();
    const service = new RoomService(roomRepository);

    const result = await service.join({
      roomCode: " room1234 ",
      playerName: " Ana ",
      playerToken: "token-secreto",
    });

    expect(roomRepository.joinRoom).toHaveBeenCalledWith(
      "ROOM1234",
      "Ana",
      hashPlayerToken("token-secreto"),
    );
    expect(result.playerToken).toBe("token-secreto");
  });

  it("mantém o início repetível delegado à operação atômica", async () => {
    const roomRepository = repository();
    const service = new RoomService(roomRepository);

    await service.start({ roomCode: "ROOM1234", playerToken: "host-token" });
    await service.start({ roomCode: "ROOM1234", playerToken: "host-token" });

    expect(roomRepository.startRoom).toHaveBeenCalledTimes(2);
    expect(roomRepository.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it("não converte falhas inesperadas em detalhes internos", async () => {
    const roomRepository = repository();
    vi.mocked(roomRepository.getSnapshot).mockRejectedValue(
      new Error("senha-interna"),
    );
    const service = new RoomService(roomRepository);

    await expect(service.getState("ROOM1234", "token")).rejects.toThrow(
      "senha-interna",
    );
  });

  it("tipa erros de autorização vindos do repositório", async () => {
    const roomRepository = repository();
    const { RoomRepositoryError } = await import("./repository");
    vi.mocked(roomRepository.getSnapshot).mockRejectedValue(
      new RoomRepositoryError("authorization", "token inválido"),
    );
    const service = new RoomService(roomRepository);

    await expect(service.getState("ROOM1234", "token")).rejects.toMatchObject({
      status: 401,
      contractError: { code: "authorization_error" },
    });
  });
});
