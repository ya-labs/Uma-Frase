import { describe, expect, it } from "vitest";

import { GAME_STATUSES, MAX_ROUNDS, type Game } from "./entities";
import {
  answerSchema,
  gameSchema,
  gameStatusSchema,
  playerSchema,
  roundSchema,
  wordLimitSchema,
} from "./schemas";

const game: Game = {
  id: "game-1",
  code: "ABC123",
  status: "answering",
  hostPlayerId: "player-1",
  round: 1,
  maxRounds: MAX_ROUNDS,
  storySummary: "",
  pausedFrom: null,
  createdAt: "2026-09-24T12:00:00.000Z",
};

describe("schemas usados pelo frontend", () => {
  it("representa todas as fases aprovadas", () => {
    GAME_STATUSES.forEach((status) => {
      expect(gameStatusSchema.parse(status)).toBe(status);
    });
  });

  it("valida a estrutura de uma partida", () => {
    expect(gameSchema.parse(game)).toEqual(game);
    expect(
      gameSchema.safeParse({ ...game, status: "unknown" }).success,
    ).toBe(false);
  });

  it("valida a estrutura de um jogador", () => {
    expect(
      playerSchema.safeParse({
        id: "player-1",
        gameId: game.id,
        name: "Ana",
        score: 0,
        isConnected: true,
      }).success,
    ).toBe(true);
  });

  it("valida a estrutura de uma rodada e o limite de palavras", () => {
    expect(
      roundSchema.safeParse({
        id: "round-1",
        gameId: game.id,
        number: 1,
        status: "answering",
        situation: "Uma porta se abriu.",
        wordLimit: 5,
        answerDeadlineAt: "2026-09-24T12:00:10.000Z",
        winnerPlayerId: null,
        reason: null,
        continuation: null,
        nextSituation: null,
      }).success,
    ).toBe(true);
    expect(wordLimitSchema.safeParse(0).success).toBe(false);
    expect(wordLimitSchema.safeParse(16).success).toBe(false);
  });

  it("valida a estrutura de uma resposta", () => {
    expect(
      answerSchema.safeParse({
        id: "answer-1",
        roundId: "round-1",
        playerId: "player-1",
        text: "Eu atravesso a porta.",
        submittedAt: "2026-09-24T12:00:08.000Z",
      }).success,
    ).toBe(true);
  });
});
