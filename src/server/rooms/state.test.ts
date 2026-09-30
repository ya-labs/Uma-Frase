import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_ROUNDS, type GameStatus } from "@/domain/game";

import type { RoomSnapshot } from "./repository";
import { buildRoomState } from "./state";

function snapshot(status: GameStatus): RoomSnapshot {
  const game = {
    id: "game-1",
    code: "ROOM1234",
    status,
    hostPlayerId: "player-1",
    round: 1,
    maxRounds: MAX_ROUNDS,
    storySummary: "segredo do servidor",
    pausedFrom: null,
    createdAt: "2026-09-30T12:00:00.000Z",
  } as const;
  const currentRound = {
    id: "round-1",
    gameId: game.id,
    number: 1,
    status,
    situation: "Uma porta apareceu.",
    wordLimit: 5,
    answerDeadlineAt: "2026-09-30T12:00:10.000Z",
    winnerPlayerId: "player-1",
    reason: "Foi mais criativa.",
    continuation: "A porta se abriu.",
    nextSituation: "Um corredor escuro.",
  };

  return {
    playerId: "player-1",
    state: {
      game,
      players: [
        {
          id: "player-1",
          gameId: game.id,
          name: "Ana",
          score: 1,
          isConnected: true,
        },
        {
          id: "player-2",
          gameId: game.id,
          name: "Beto",
          score: 0,
          isConnected: true,
        },
      ],
      currentRound,
      answers: [
        {
          id: "answer-1",
          roundId: currentRound.id,
          playerId: "player-1",
          text: "Eu abro a porta.",
          submittedAt: "2026-09-30T12:00:05.000Z",
        },
        {
          id: "answer-2",
          roundId: currentRound.id,
          playerId: "player-2",
          text: "Eu bato três vezes.",
          submittedAt: "2026-09-30T12:00:06.000Z",
        },
      ],
    },
  };
}

describe("estado HTTP da sala", () => {
  it("oculta respostas alheias e resultado antes da revelação", () => {
    const state = buildRoomState(snapshot("answering"));

    expect(state.public.currentRound).not.toHaveProperty("answers");
    expect(state.public.currentRound?.winnerPlayerId).toBeNull();
    expect(state.private.answer?.text).toBe("Eu abro a porta.");
    expect(state.public.game).not.toHaveProperty("hostPlayerId");
    expect(JSON.stringify(state)).not.toContain("segredo do servidor");
  });

  it("publica respostas e resultado somente na revelação", () => {
    const state = buildRoomState(snapshot("reveal"));

    expect(state.public.currentRound?.answers).toHaveLength(2);
    expect(state.public.currentRound?.winnerPlayerId).toBe("player-1");
    expect(state.private.isHost).toBe(true);
  });
});
