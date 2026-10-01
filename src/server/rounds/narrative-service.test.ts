import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import type { RoomRepository, RoomSnapshot } from "../rooms/repository";
import type { RoundRepository } from "./repository";
import type { NarrativeRepository } from "./narrative-repository";
import { NarrativeService } from "./narrative-service";
import { DemoNarrativeProvider } from "../ai/provider";

function setup() {
  const snapshot: RoomSnapshot = {
    playerId: "host",
    state: {
      game: {
        id: "game",
        code: "ABCD2345",
        status: "generating",
        hostPlayerId: "host",
        round: 1,
        maxRounds: 8,
        storySummary: "",
        pausedFrom: null,
        createdAt: "2026-10-01T12:00:00Z",
      },
      players: [
        {
          id: "host",
          gameId: "game",
          name: "Ana",
          score: 0,
          isConnected: true,
        },
      ],
      answers: [],
      currentRound: null,
    },
  };
  const rooms = {
    getSnapshot: vi.fn().mockResolvedValue(snapshot),
  } as unknown as RoomRepository;
  const rounds = { tick: vi.fn() } as unknown as RoundRepository;
  const work: NarrativeRepository = {
    claim: vi.fn().mockResolvedValue(null),
    finish: vi.fn(),
    fail: vi.fn(),
    advance: vi.fn(),
  };
  const provider = vi.fn(() => new DemoNarrativeProvider());
  return {
    rooms,
    work,
    provider,
    service: new NarrativeService(rooms, rounds, work, provider),
  };
}
describe("coordenação narrativa", () => {
  it("não chama provedor se outro processo reservou o trabalho", async () => {
    const { service, provider } = setup();
    await service.getState("ABCD2345", "token");
    expect(provider).not.toHaveBeenCalled();
  });
  it("publica apenas um resultado validado por requisição", async () => {
    const { service, work } = setup();
    vi.mocked(work.claim).mockResolvedValue({
      token: "lease",
      kind: "generate",
    });
    await service.getState("ABCD2345", "token");
    expect(work.claim).toHaveBeenCalledTimes(1);
    expect(work.finish).toHaveBeenCalledWith(
      "ABCD2345",
      expect.any(String),
      { token: "lease", kind: "generate" },
      expect.objectContaining({
        wordLimit: expect.any(Number),
        situation: expect.any(String),
      }),
    );
  });
  it("persiste falha genérica sem segredos quando configuração/provedor falha", async () => {
    const { service, provider, work } = setup();
    vi.mocked(work.claim).mockResolvedValue({
      token: "lease",
      kind: "generate",
    });
    provider.mockImplementation(() => {
      throw new Error("secret-sdk-key");
    });
    const state = await service.getState("ABCD2345", "token");
    expect(work.fail).toHaveBeenCalledWith("ABCD2345", expect.any(String), {
      token: "lease",
      kind: "generate",
    });
    expect(work.finish).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).not.toContain("secret-sdk-key");
  });
  it("repetição manual é decidida pela reserva autoritativa", async () => {
    const { service, work } = setup();
    await service.retry({ roomCode: "ABCD2345", playerToken: "token" });
    expect(work.claim).toHaveBeenCalledWith(
      "ABCD2345",
      expect.any(String),
      true,
    );
  });
});
