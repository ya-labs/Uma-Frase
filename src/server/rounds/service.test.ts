import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { RoundService } from "./service";
import { hashPlayerToken } from "../rooms/identity";
import { RoomRepositoryError, type RoomRepository } from "../rooms/repository";
import type { RoundRepository } from "./repository";

function setup() {
  const rooms = { getSnapshot: vi.fn() } as unknown as RoomRepository;
  const rounds: RoundRepository = {
    open: vi.fn(),
    tick: vi.fn(),
    submit: vi.fn(),
  };
  return { rooms, rounds, service: new RoundService(rooms, rounds) };
}

describe("motor de rodadas", () => {
  it("confere prazo no servidor antes de buscar o estado", async () => {
    const { service, rounds, rooms } = setup();
    vi.mocked(rooms.getSnapshot).mockRejectedValue(
      new Error("snapshot marker"),
    );
    await expect(service.getState(" abcd2345 ", "secret")).rejects.toThrow(
      "snapshot marker",
    );
    expect(rounds.tick).toHaveBeenCalledWith(
      "ABCD2345",
      hashPlayerToken("secret"),
    );
    expect(vi.mocked(rounds.tick).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(rooms.getSnapshot).mock.invocationCallOrder[0],
    );
  });

  it("não consulta respostas depois de uma identidade recusada", async () => {
    const { service, rounds, rooms } = setup();
    vi.mocked(rounds.tick).mockRejectedValue(
      new RoomRepositoryError("authorization", "internal"),
    );
    await expect(service.getState("ABCD2345", "secret")).rejects.toMatchObject({
      status: 401,
    });
    expect(rooms.getSnapshot).not.toHaveBeenCalled();
  });

  it("delega validação e unicidade ao envio atômico sem enviar token puro", async () => {
    const { service, rounds } = setup();
    vi.mocked(rounds.submit).mockRejectedValue(
      new RoomRepositoryError("conflict", "deadline expired"),
    );
    await expect(
      service.submit({
        roomCode: "ABCD2345",
        playerToken: "secret",
        roundId: "round-1",
        text: " Olá! ",
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(rounds.submit).toHaveBeenCalledWith(
      "ABCD2345",
      hashPlayerToken("secret"),
      "round-1",
      "Olá!",
    );
  });
});
