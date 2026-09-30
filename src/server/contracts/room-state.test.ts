import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_ROUNDS } from "@/domain/game";

import { serverRoomStateSchema } from "./room-state";

describe("estado exclusivo do servidor", () => {
  it("mantém história, identidade do host e todas as respostas fora do estado público", () => {
    const game = {
      id: "game-1",
      code: "ABC123",
      status: "answering",
      hostPlayerId: "player-1",
      round: 1,
      maxRounds: MAX_ROUNDS,
      storySummary: "Uma porta misteriosa apareceu.",
      pausedFrom: null,
      createdAt: "2026-09-30T11:00:00.000Z",
    };
    const players = [
      {
        id: "player-1",
        gameId: game.id,
        name: "Ana",
        score: 0,
        isConnected: true,
      },
      {
        id: "player-2",
        gameId: game.id,
        name: "Bruno",
        score: 0,
        isConnected: true,
      },
    ];
    const currentRound = {
      id: "round-1",
      gameId: game.id,
      number: 1,
      status: "answering",
      situation: "Uma porta se abriu.",
      wordLimit: 5,
      answerDeadlineAt: "2026-09-30T11:00:10.000Z",
      winnerPlayerId: null,
      reason: null,
      continuation: null,
      nextSituation: null,
    };
    const answers = [
      {
        id: "answer-1",
        roundId: currentRound.id,
        playerId: "player-1",
        text: "Eu atravesso sem olhar.",
        submittedAt: "2026-09-30T11:00:07.000Z",
      },
      {
        id: "answer-2",
        roundId: currentRound.id,
        playerId: "player-2",
        text: "Eu fecho a porta.",
        submittedAt: "2026-09-30T11:00:08.000Z",
      },
    ];

    expect(
      serverRoomStateSchema.safeParse({
        game,
        players,
        currentRound,
        answers,
      }).success,
    ).toBe(true);
  });
});
