import { describe, expect, it } from "vitest";

import {
  MAX_ROUNDS,
  type Answer,
  type Game,
  type Player,
  type Round,
} from "./entities";
import { resolveRound } from "./game-rules";

const game: Game = {
  id: "game-1",
  code: "ABC123",
  status: "judging",
  hostPlayerId: "player-1",
  round: 1,
  maxRounds: MAX_ROUNDS,
  storySummary: "",
  pausedFrom: null,
  createdAt: "2026-09-29T12:00:00.000Z",
};

const round: Round = {
  id: "round-1",
  gameId: game.id,
  number: 1,
  status: "judging",
  situation: "Uma porta se abriu.",
  wordLimit: 5,
  answerDeadlineAt: "2026-09-29T12:00:10.000Z",
  winnerPlayerId: null,
  reason: null,
  continuation: null,
  nextSituation: null,
};

const players: readonly Player[] = [
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

function answer(playerId: string, text: string): Answer {
  return {
    id: `answer-${playerId}`,
    roundId: round.id,
    playerId,
    text,
    submittedAt: "2026-09-29T12:00:08.000Z",
  };
}

describe("resolveRound", () => {
  it("concede vitória automática contra uma ausência", () => {
    const result = resolveRound({
      game,
      round,
      players,
      answers: [answer("player-1", "Eu atravesso."), answer("player-2", " ")],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: "single_answer",
        winnerPlayerId: "player-1",
        players: [{ score: 1 }, { score: 0 }],
      },
    });
  });

  it("não pontua quando os dois jogadores ficam sem resposta", () => {
    const result = resolveRound({
      game,
      round,
      players,
      answers: [],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        kind: "no_answers",
        winnerPlayerId: null,
        players,
      },
    });
  });

  it("aplica o vencedor julgado quando ambos respondem", () => {
    const result = resolveRound({
      game,
      round,
      players,
      answers: [
        answer("player-1", "Eu atravesso."),
        answer("player-2", "Eu fecho a porta."),
      ],
      judgedWinnerPlayerId: "player-2",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        kind: "judged",
        winnerPlayerId: "player-2",
        players: [{ score: 0 }, { score: 1 }],
      },
    });
  });

  it("recusa vencedor ausente ou inelegível", () => {
    const missingWinner = resolveRound({
      game,
      round,
      players,
      answers: [
        answer("player-1", "Eu atravesso."),
        answer("player-2", "Eu fecho a porta."),
      ],
    });
    const unknownWinner = resolveRound({
      game,
      round,
      players,
      answers: [
        answer("player-1", "Eu atravesso."),
        answer("player-2", "Eu fecho a porta."),
      ],
      judgedWinnerPlayerId: "player-3",
    });

    expect(missingWinner).toMatchObject({
      ok: false,
      error: { code: "invalid_winner" },
    });
    expect(unknownWinner).toMatchObject({
      ok: false,
      error: { code: "invalid_winner" },
    });
  });

  it("recusa respostas duplicadas ou de outra rodada", () => {
    const duplicated = resolveRound({
      game,
      round,
      players,
      answers: [answer("player-1", "Uma."), answer("player-1", "Duas.")],
    });
    const otherRound = resolveRound({
      game,
      round,
      players,
      answers: [{ ...answer("player-1", "Uma."), roundId: "round-2" }],
    });

    expect(duplicated).toMatchObject({
      ok: false,
      error: { code: "duplicate_answer" },
    });
    expect(otherRound).toMatchObject({
      ok: false,
      error: { code: "answer_from_another_round" },
    });
  });

  it("protege o limite máximo de pontuação", () => {
    const result = resolveRound({
      game,
      round,
      players: [{ ...players[0], score: MAX_ROUNDS }, players[1]],
      answers: [answer("player-1", "Eu atravesso.")],
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "score_limit_exceeded" },
    });
  });
});
