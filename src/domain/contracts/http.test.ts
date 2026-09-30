import { describe, expect, it } from "vitest";

import {
  contractErrorResponseSchema,
  createRoomResponseSchema,
  getRoomStateResponseSchema,
  roomHttpContracts,
  type CreateRoomCommand,
} from ".";
import { roomStateFixture } from "./fixtures";

const validCommands = {
  create: { playerName: "Ana" },
  join: { roomCode: "ABCD2345", playerName: "Bruno" },
  start: {
    roomCode: "ABCD2345",
    playerToken: "opaque-token-with-at-least-32-chars",
  },
  state: {
    roomCode: "ABCD2345",
    playerToken: "opaque-token-with-at-least-32-chars",
  },
  presence: {
    roomCode: "ABCD2345",
    playerToken: "opaque-token-with-at-least-32-chars",
    isConnected: true,
  },
  answer: {
    roomCode: "ABCD2345",
    playerToken: "opaque-token-with-at-least-32-chars",
    roundId: "round-1",
    text: "Eu atravesso a porta.",
  },
  resolve: {
    roomCode: "ABCD2345",
    playerToken: "opaque-token-with-at-least-32-chars",
    roundId: "round-1",
  },
  pause: {
    roomCode: "ABCD2345",
    playerToken: "opaque-token-with-at-least-32-chars",
  },
  resume: {
    roomCode: "ABCD2345",
    playerToken: "opaque-token-with-at-least-32-chars",
  },
} as const;

describe("contratos HTTP da sala", () => {
  it("possui schema para todas as operações previstas", () => {
    Object.entries(roomHttpContracts).forEach(([operation, contract]) => {
      const payload = validCommands[operation as keyof typeof validCommands];

      expect(contract.commandSchema.safeParse(payload).success).toBe(true);
    });
  });

  it("infere o tipo do comando a partir do schema", () => {
    const command: CreateRoomCommand =
      roomHttpContracts.create.commandSchema.parse(validCommands.create);

    expect(command).toEqual({ playerName: "Ana" });
  });

  it("rejeita campos ausentes e campos desconhecidos", () => {
    expect(
      roomHttpContracts.answer.commandSchema.safeParse({
        roomCode: "ABCD2345",
        playerToken: "opaque-token-with-at-least-32-chars",
        text: "Sem rodada.",
      }).success,
    ).toBe(false);
    expect(
      roomHttpContracts.start.commandSchema.safeParse({
        roomCode: "ABCD2345",
        playerToken: "opaque-token-with-at-least-32-chars",
        serverOnly: true,
      }).success,
    ).toBe(false);
    expect(
      roomHttpContracts.join.commandSchema.safeParse({
        roomCode: "codigo previsivel",
        playerName: "Bruno",
      }).success,
    ).toBe(false);
    expect(
      roomHttpContracts.create.commandSchema.safeParse({
        playerName: "A".repeat(81),
      }).success,
    ).toBe(false);
  });

  it("serializa respostas de criação e consulta", () => {
    const createResponse = {
      ok: true as const,
      data: {
        playerToken: "opaque-token-with-at-least-32-chars",
        state: roomStateFixture,
      },
    };
    const stateResponse = {
      ok: true as const,
      data: { state: roomStateFixture },
    };

    expect(
      createRoomResponseSchema.parse(
        JSON.parse(JSON.stringify(createResponse)),
      ),
    ).toEqual(createResponse);
    expect(
      getRoomStateResponseSchema.parse(
        JSON.parse(JSON.stringify(stateResponse)),
      ),
    ).toEqual(stateResponse);
  });

  it("padroniza erros nas respostas das operações", () => {
    const response = {
      ok: false as const,
      error: {
        code: "phase_conflict" as const,
        message: "A sala não pode iniciar nesta fase.",
        currentStatus: "answering" as const,
        expectedStatuses: ["waiting" as const],
      },
    };

    expect(contractErrorResponseSchema.parse(response)).toEqual(response);
    expect(createRoomResponseSchema.parse(response)).toEqual(response);
  });
});
