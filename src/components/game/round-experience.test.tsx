import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ANSWER_DURATION_SECONDS,
  type GameStatus,
  type RoomState,
} from "@/domain";
import { roomStateFixture } from "@/domain/contracts/fixtures";

import { RoundExperience } from "./round-experience";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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

function renderState(
  state: RoomState,
  options: {
    submitting?: boolean;
    submitError?: string | null;
    onSubmitAnswer?: (roundId: string, text: string) => void;
  } = {},
) {
  const onSubmitAnswer = options.onSubmitAnswer ?? vi.fn();
  const view = render(
    <RoundExperience
      state={state}
      connectionStatus="connected"
      lastSyncedAt="12:00:00"
      submitting={options.submitting ?? false}
      submitError={options.submitError ?? null}
      onSubmitAnswer={onSubmitAnswer}
    />,
  );

  return { ...view, onSubmitAnswer };
}

function unansweredState(deadline = "2026-09-30T12:00:10.000Z"): RoomState {
  const answering = stateAt("answering");

  return {
    ...answering,
    public: {
      ...answering.public,
      players: answering.public.players.map((player) => ({
        ...player,
        hasAnswered:
          player.id === answering.private.playerId ? false : player.hasAnswered,
      })),
      currentRound: {
        ...answering.public.currentRound!,
        answerDeadlineAt: deadline,
      },
    },
    private: { ...answering.private, answer: null },
  };
}

describe("experiência visual da rodada", () => {
  it("acompanha um minuto confirmado pelo servidor e só tenta enviar ao expirar", () => {
    expect(ANSWER_DURATION_SECONDS).toBe(60);
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-30T12:00:00Z");
    const onSubmitAnswer = vi.fn();
    renderState(unansweredState("2026-09-30T12:01:00.000Z"), {
      onSubmitAnswer,
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Sua resposta" }), {
      target: { value: "Eu sigo em frente." },
    });
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "60 segundos restantes",
    );

    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "45 segundos restantes",
    );
    expect(onSubmitAnswer).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(44_000));
    expect(onSubmitAnswer).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "0 segundos restantes",
    );
    expect(onSubmitAnswer).toHaveBeenCalledTimes(1);
    expect(onSubmitAnswer).toHaveBeenCalledWith(
      roomStateFixture.public.currentRound!.id,
      "Eu sigo em frente.",
    );
    act(() => vi.advanceTimersByTime(2_000));
    expect(onSubmitAnswer).toHaveBeenCalledTimes(1);
  });

  it("corrige um relógio cliente adiantado usando o instante recebido do servidor", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2029-09-30T12:00:00Z");
    const state = unansweredState();
    state.public.control = {
      revision: 1,
      workError: false,
      canRetry: false,
      serverNow: "2026-09-30T12:00:00Z",
    };
    render(
      <RoundExperience
        state={state}
        clockReceivedAt={Date.now()}
        connectionStatus="connected"
        lastSyncedAt={null}
        submitting={false}
        submitError={null}
        onSubmitAnswer={vi.fn()}
      />,
    );
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "10 segundos restantes",
    );
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "9 segundos restantes",
    );
  });
  it("não envia nem consome tempo visual durante uma pausa confirmada", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-30T12:00:00Z");
    const state = unansweredState();
    state.public.game.status = "paused";
    state.public.game.pausedFrom = "answering";
    state.public.control = {
      revision: 1,
      workError: false,
      canRetry: false,
      remainingAnswerMs: 4000,
    };
    const { onSubmitAnswer } = renderState(state);
    expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "4 segundos restantes",
    );
    expect(onSubmitAnswer).not.toHaveBeenCalled();
  });
  it("exibe epílogo e não oferece nona rodada", () => {
    const state = stateAt("finished");
    state.public.game.round = 8;
    state.public.game.epilogue = "Fim da aventura confirmada.";
    state.public.game.storySummary = "Resumo confirmado.";
    renderState(state);
    expect(screen.getByText("Fim da aventura confirmada.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Próxima rodada" })).toBeNull();
  });
  it("não oferece retry narrativo sem autorização pública", () => {
    const state = stateAt("judging_error");
    state.public.control = { revision: 1, workError: true, canRetry: false };
    render(
      <RoundExperience
        state={state}
        connectionStatus="connected"
        lastSyncedAt={null}
        submitting={false}
        submitError={null}
        onSubmitAnswer={vi.fn()}
        onRetryNarrative={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /aguardando liberação/i }),
    ).toHaveProperty("disabled", true);
  });
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

  it("conta palavras em tempo real e bloqueia visualmente o excesso", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-30T12:00:00.000Z");
    renderState(unansweredState());
    const field = screen.getByRole("textbox", { name: "Sua resposta" });
    const submit = screen.getByRole("button", { name: /enviar resposta/i });

    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "10 segundos restantes",
    );

    fireEvent.change(field, { target: { value: "Olá, mundo!" } });
    expect(screen.getByText("2 / 5 palavras")).toBeDefined();
    expect(submit).toHaveProperty("disabled", false);

    fireEvent.change(field, {
      target: { value: "uma frase com seis palavras agora" },
    });
    expect(screen.getByText("6 / 5 palavras")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("Reduza sua frase");
    expect(submit).toHaveProperty("disabled", true);
  });

  it("envia uma única vez por clique repetido e pelo atalho de teclado", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-30T12:00:00.000Z");
    const clickSubmit = vi.fn();
    const first = renderState(unansweredState(), {
      onSubmitAnswer: clickSubmit,
    });
    const field = screen.getByRole("textbox", { name: "Sua resposta" });

    fireEvent.change(field, { target: { value: "Eu sigo em frente." } });
    const button = screen.getByRole("button", { name: /enviar resposta/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(clickSubmit).toHaveBeenCalledTimes(1);
    expect(clickSubmit).toHaveBeenCalledWith("round-1", "Eu sigo em frente.");

    first.unmount();

    const keyboardSubmit = vi.fn();
    renderState(unansweredState(), { onSubmitAnswer: keyboardSubmit });
    const keyboardField = screen.getByRole("textbox", {
      name: "Sua resposta",
    });
    fireEvent.change(keyboardField, { target: { value: "Outra resposta." } });
    fireEvent.keyDown(keyboardField, { key: "Enter", ctrlKey: true });

    expect(keyboardSubmit).toHaveBeenCalledTimes(1);
  });

  it("tenta enviar o texto válido uma única vez quando o prazo zera", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-30T12:00:00.000Z");
    const onSubmitAnswer = vi.fn();
    renderState(unansweredState("2026-09-30T12:00:01.000Z"), {
      onSubmitAnswer,
    });

    fireEvent.change(screen.getByRole("textbox", { name: "Sua resposta" }), {
      target: { value: "Resposta automática." },
    });

    act(() => vi.advanceTimersByTime(1_000));
    expect(onSubmitAnswer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "0 segundos restantes",
    );

    act(() => vi.advanceTimersByTime(2_000));
    expect(onSubmitAnswer).toHaveBeenCalledTimes(1);
  });

  it("corrige o cronômetro quando recebe um novo prazo do servidor", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-30T12:00:00.000Z");
    const onSubmitAnswer = vi.fn();
    const view = renderState(unansweredState(), { onSubmitAnswer });

    act(() => vi.advanceTimersByTime(2_000));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "8 segundos restantes",
    );

    view.rerender(
      <RoundExperience
        state={unansweredState("2026-09-30T12:00:05.000Z")}
        connectionStatus="connected"
        lastSyncedAt="12:00:02"
        submitting={false}
        submitError={null}
        onSubmitAnswer={onSubmitAnswer}
      />,
    );

    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "3 segundos restantes",
    );
  });

  it("preserva o texto e permite repetir após uma falha recuperável", () => {
    vi.useFakeTimers();
    vi.setSystemTime("2026-09-30T12:00:00.000Z");
    const onSubmitAnswer = vi.fn();
    const state = unansweredState();
    const view = renderState(state, { onSubmitAnswer });
    const field = screen.getByRole("textbox", { name: "Sua resposta" });

    fireEvent.change(field, { target: { value: "Minha frase permanece." } });
    fireEvent.click(screen.getByRole("button", { name: /enviar resposta/i }));

    view.rerender(
      <RoundExperience
        state={state}
        connectionStatus="connected"
        lastSyncedAt="12:00:00"
        submitting={false}
        submitError="Não foi possível enviar sua resposta. Tente novamente."
        onSubmitAnswer={onSubmitAnswer}
      />,
    );

    expect(
      (
        screen.getByRole("textbox", {
          name: "Sua resposta",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Minha frase permanece.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onSubmitAnswer).toHaveBeenCalledTimes(2);
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
