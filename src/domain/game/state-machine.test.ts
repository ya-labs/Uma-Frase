import { describe, expect, it } from "vitest";

import { MAX_ROUNDS, type Game, type Player } from "./entities";
import { transitionGame, type GameEvent } from "./state-machine";

const waitingGame: Game = {
  id: "game-1",
  code: "ABC123",
  status: "waiting",
  hostPlayerId: "player-1",
  round: 0,
  maxRounds: MAX_ROUNDS,
  storySummary: "",
  pausedFrom: null,
  createdAt: "2026-09-29T12:00:00.000Z",
};

const players: readonly Player[] = [
  {
    id: "player-1",
    gameId: waitingGame.id,
    name: "Ana",
    score: 0,
    isConnected: true,
  },
  {
    id: "player-2",
    gameId: waitingGame.id,
    name: "Bruno",
    score: 0,
    isConnected: true,
  },
];

function applyEvents(game: Game, events: readonly GameEvent[]): Game {
  return events.reduce((currentGame, event) => {
    const result = transitionGame(currentGame, event);

    expect(result.ok).toBe(true);

    if (!result.ok) throw new Error(result.error.message);

    return result.value;
  }, game);
}

describe("transitionGame", () => {
  it("percorre o fluxo válido de uma rodada", () => {
    const result = applyEvents(waitingGame, [
      { type: "start", players },
      { type: "situation_ready" },
      { type: "open_answers" },
      { type: "close_answers" },
      { type: "judgment_succeeded" },
    ]);

    expect(result).toMatchObject({ status: "reveal", round: 1 });
  });

  it("recusa uma transição que não pertence à fase atual", () => {
    const result = transitionGame(waitingGame, { type: "open_answers" });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "invalid_transition",
        message:
          "O evento open_answers não é permitido durante a fase waiting.",
      },
    });
  });

  it("exige dois jogadores conectados para iniciar", () => {
    const missingPlayer = transitionGame(waitingGame, {
      type: "start",
      players: players.slice(0, 1),
    });
    const disconnectedPlayer = transitionGame(waitingGame, {
      type: "start",
      players: [{ ...players[0], isConnected: false }, players[1]],
    });

    expect(missingPlayer).toMatchObject({
      ok: false,
      error: { code: "invalid_player_count" },
    });
    expect(disconnectedPlayer).toMatchObject({
      ok: false,
      error: { code: "player_not_connected" },
    });
  });

  it("recusa jogadores duplicados no roster", () => {
    const result = transitionGame(waitingGame, {
      type: "start",
      players: [players[0], { ...players[0], name: "Ana duplicada" }],
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "duplicate_player" },
    });
  });

  it("preserva e restaura a fase ao pausar e retomar", () => {
    const answeringGame = applyEvents(waitingGame, [
      { type: "start", players },
      { type: "situation_ready" },
      { type: "open_answers" },
    ]);
    const pausedResult = transitionGame(answeringGame, { type: "pause" });

    expect(pausedResult).toMatchObject({
      ok: true,
      value: { status: "paused", pausedFrom: "answering" },
    });

    if (!pausedResult.ok) throw new Error(pausedResult.error.message);

    expect(
      transitionGame(pausedResult.value, { type: "resume" }),
    ).toMatchObject({
      ok: true,
      value: { status: "answering", pausedFrom: null },
    });
  });

  it("recusa pausa fora das fases pausáveis", () => {
    expect(transitionGame(waitingGame, { type: "pause" })).toMatchObject({
      ok: false,
      error: { code: "invalid_transition" },
    });
  });

  it("avança rodadas e encerra a partida depois da oitava", () => {
    const firstReveal: Game = {
      ...waitingGame,
      status: "reveal",
      round: 1,
    };
    const nextRound = transitionGame(firstReveal, { type: "advance_round" });
    const lastReveal: Game = {
      ...firstReveal,
      round: MAX_ROUNDS,
    };
    const finished = transitionGame(lastReveal, { type: "advance_round" });

    expect(nextRound).toMatchObject({
      ok: true,
      value: { status: "generating", round: 2 },
    });
    expect(finished).toMatchObject({
      ok: true,
      value: { status: "finished", round: MAX_ROUNDS },
    });
  });

  it("permite repetir o julgamento depois de uma falha", () => {
    const judgingGame: Game = {
      ...waitingGame,
      status: "judging",
      round: 1,
    };
    const failed = transitionGame(judgingGame, { type: "judgment_failed" });

    expect(failed).toMatchObject({
      ok: true,
      value: { status: "judging_error" },
    });

    if (!failed.ok) throw new Error(failed.error.message);

    expect(
      transitionGame(failed.value, { type: "retry_judgment" }),
    ).toMatchObject({
      ok: true,
      value: { status: "judging" },
    });
  });
});
