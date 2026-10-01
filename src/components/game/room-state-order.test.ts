import { describe, expect, it } from "vitest";

import type { GameStatus, RoomState } from "@/domain";
import { roomStateFixture } from "@/domain/contracts/fixtures";

import { shouldAcceptRoomState } from "./room-state-order";

function stateAt(
  status: GameStatus,
  overrides: Partial<RoomState> = {},
): RoomState {
  return {
    ...roomStateFixture,
    public: {
      ...roomStateFixture.public,
      game: {
        ...roomStateFixture.public.game,
        status,
        pausedFrom: null,
      },
    },
    ...overrides,
  };
}

describe("ordenação dos estados recebidos", () => {
  it("aceita repetições e avanços confirmados pelo servidor", () => {
    const answering = stateAt("answering");

    expect(shouldAcceptRoomState(answering, answering)).toBe(true);
    expect(shouldAcceptRoomState(answering, stateAt("judging"))).toBe(true);
    expect(shouldAcceptRoomState(answering, stateAt("reveal"))).toBe(true);
  });

  it("ignora uma fase atrasada da mesma rodada", () => {
    expect(
      shouldAcceptRoomState(stateAt("judging"), stateAt("situation")),
    ).toBe(false);
  });

  it("não perde uma resposta já confirmada por uma leitura atrasada", () => {
    const confirmed = stateAt("answering");
    const stale = {
      ...stateAt("answering"),
      private: { ...roomStateFixture.private, answer: null },
    };

    expect(shouldAcceptRoomState(confirmed, stale)).toBe(false);
  });

  it("aceita a rodada seguinte e recusa o retorno à anterior", () => {
    const firstRound = stateAt("reveal");
    const secondRound = {
      ...stateAt("generating"),
      public: {
        ...stateAt("generating").public,
        game: { ...stateAt("generating").public.game, round: 2 },
        currentRound: null,
      },
      private: { ...roomStateFixture.private, answer: null },
    };

    expect(shouldAcceptRoomState(firstRound, secondRound)).toBe(true);
    expect(shouldAcceptRoomState(secondRound, firstRound)).toBe(false);
  });

  it("aceita pausa e retomada na mesma fase pública", () => {
    const answering = stateAt("answering");
    const paused = {
      ...answering,
      public: {
        ...answering.public,
        game: {
          ...answering.public.game,
          status: "paused" as const,
          pausedFrom: "answering" as const,
        },
      },
    };

    expect(shouldAcceptRoomState(answering, paused)).toBe(true);
    expect(shouldAcceptRoomState(paused, answering)).toBe(true);
  });
});
