import { describe, expect, it } from "vitest";

import { roomStateFixture } from "./fixtures";
import {
  publicRoomStateSchema,
  roomStateSchema,
  type RoomState,
} from "./state";

const publicState: RoomState["public"] = roomStateFixture.public;

describe("contratos de estado da sala", () => {
  it("serializa o estado canônico sem perder o estado privado do jogador", () => {
    const serialized = JSON.stringify(roomStateSchema.parse(roomStateFixture));

    expect(roomStateSchema.parse(JSON.parse(serialized))).toEqual(
      roomStateFixture,
    );
  });

  it("rejeita uma resposta adversária no estado público antes do reveal", () => {
    const leakedState = {
      ...publicState,
      currentRound: {
        ...publicState.currentRound!,
        answers: [
          { playerId: "player-2", text: "Resposta secreta do adversário." },
        ],
      },
    };

    expect(publicRoomStateSchema.safeParse(leakedState).success).toBe(false);
  });

  it("rejeita o resultado da IA no estado público antes do reveal", () => {
    const leakedState = {
      ...publicState,
      currentRound: {
        ...publicState.currentRound!,
        winnerPlayerId: "player-1",
        reason: "A melhor resposta.",
      },
    };

    expect(publicRoomStateSchema.safeParse(leakedState).success).toBe(false);
  });

  it("publica as respostas somente durante o reveal", () => {
    const revealedState = {
      ...publicState,
      game: { ...publicState.game, status: "reveal" as const },
      currentRound: {
        ...publicState.currentRound!,
        winnerPlayerId: "player-1",
        reason: "A resposta continuou melhor a história.",
        continuation: "Ana atravessou a porta.",
        nextSituation: "Do outro lado havia duas escadas.",
        answers: [
          {
            playerId: "player-1",
            text: "Eu atravesso sem olhar para trás.",
          },
          { playerId: "player-2", text: "Eu fecho a porta depressa." },
        ],
      },
    };

    expect(publicRoomStateSchema.safeParse(revealedState).success).toBe(true);
    expect(
      publicRoomStateSchema.safeParse({
        ...revealedState,
        currentRound: { ...revealedState.currentRound, answers: undefined },
      }).success,
    ).toBe(false);
  });
});
