import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { GameStatus, RoomState } from "@/domain";
import { roomStateFixture } from "@/domain/contracts/fixtures";

import { RoundExperience } from "./round-experience";

afterEach(cleanup);

function stateAt(status: GameStatus): RoomState {
  const revealsResult = status === "reveal" || status === "finished";
  const showsRound = status !== "generating";
  const showsLimit = !["generating", "situation"].includes(status);

  return {
    public: {
      game: {
        ...roomStateFixture.public.game,
        status,
        pausedFrom: null,
      },
      players: roomStateFixture.public.players.map((player) => ({
        ...player,
        hasAnswered: status === "answering" || status === "judging",
      })),
      currentRound: showsRound
        ? {
            ...roomStateFixture.public.currentRound!,
            wordLimit: showsLimit ? 5 : null,
            answerDeadlineAt: showsLimit ? "2026-09-30T12:00:10.000Z" : null,
            winnerPlayerId: revealsResult ? "player-1" : null,
            reason: revealsResult ? "A frase ampliou melhor a história." : null,
            continuation: revealsResult ? "Ana atravessou a porta." : null,
            nextSituation: revealsResult
              ? "Uma escada surgiu no escuro."
              : null,
            ...(revealsResult
              ? {
                  answers: [
                    { playerId: "player-1", text: "Eu sigo em frente." },
                    { playerId: "player-2", text: "Eu fecho a porta." },
                  ],
                }
              : {}),
          }
        : null,
    },
    private: {
      ...roomStateFixture.private,
      answer:
        status === "answering" || status === "judging"
          ? roomStateFixture.private.answer
          : null,
    },
  };
}

function renderState(state: RoomState) {
  return render(
    <RoundExperience
      state={state}
      connectionStatus="connected"
      lastSyncedAt="12:00:00"
    />,
  );
}

describe("experiência visual da rodada", () => {
  it("mostra a geração sem inventar detalhes da rodada", () => {
    renderState(stateAt("generating"));

    expect(screen.getByText("Criando a situação da rodada…")).toBeDefined();
    expect(screen.queryByText("Uma porta se abriu.")).toBeNull();
  });

  it("revela primeiro a situação e mantém o limite oculto", () => {
    renderState(stateAt("situation"));

    expect(screen.getByText("Uma porta se abriu.")).toBeDefined();
    expect(screen.getByText("?")).toBeDefined();
    expect(screen.getByText(/servidor revelará o mesmo limite/i)).toBeDefined();
  });

  it("mostra limite e estado privado da própria resposta ao responder", () => {
    renderState(stateAt("answering"));

    expect(screen.getByLabelText("Limite de palavras")).toHaveProperty(
      "textContent",
      "Limite revelado5palavras",
    );
    expect(screen.getByText("Agora é só aguardar.")).toBeDefined();
    expect(screen.getByLabelText("Sua resposta").textContent).toContain(
      roomStateFixture.private.answer!.text,
    );
  });

  it("mantém a resposta adversária oculta durante o julgamento", () => {
    renderState(stateAt("judging"));

    expect(
      screen.getByText("As respostas estão sendo julgadas."),
    ).toBeDefined();
    expect(screen.queryByText("Eu fecho a porta.")).toBeNull();
  });

  it("apresenta falha de julgamento como espera, sem avançar localmente", () => {
    renderState(stateAt("judging_error"));

    expect(screen.getByText("O julgamento não foi concluído.")).toBeDefined();
    expect(screen.getByText(/nova confirmação do servidor/i)).toBeDefined();
  });

  it("revela respostas, vencedor, justificativa e continuação juntas", () => {
    renderState(stateAt("reveal"));

    expect(screen.getByText("Ana vence a rodada.")).toBeDefined();
    expect(screen.getByText(/Eu sigo em frente\./)).toBeDefined();
    expect(screen.getByText(/Eu fecho a porta\./)).toBeDefined();
    expect(
      screen.getByText("A frase ampliou melhor a história."),
    ).toBeDefined();
    expect(screen.getByText("Ana atravessou a porta.")).toBeDefined();
  });

  it("preserva visualmente a fase informada quando a partida pausa", () => {
    const answering = stateAt("answering");
    const paused: RoomState = {
      ...answering,
      public: {
        ...answering.public,
        game: {
          ...answering.public.game,
          status: "paused",
          pausedFrom: "answering",
        },
      },
    };

    renderState(paused);

    expect(screen.getByText("Partida pausada.")).toBeDefined();
    expect(screen.getByLabelText("Limite de palavras")).toBeDefined();
  });

  it("mostra empate sem atribuir ponto quando não há vencedor", () => {
    const reveal = stateAt("reveal");
    const noWinner: RoomState = {
      ...reveal,
      public: {
        ...reveal.public,
        currentRound: {
          ...reveal.public.currentRound!,
          winnerPlayerId: null,
          answers: [],
        },
      },
    };

    renderState(noWinner);

    expect(screen.getByText("Rodada sem ponto.")).toBeDefined();
    expect(screen.getByText("Ninguém respondeu nesta rodada.")).toBeDefined();
  });

  it("recupera o encerramento confirmado após recarregar a página", () => {
    renderState(stateAt("finished"));

    expect(screen.getByText("Fim de jogo.")).toBeDefined();
    expect(screen.getByText("Ana vence a rodada.")).toBeDefined();
    expect(screen.getByLabelText("Placar")).toBeDefined();
  });
});
