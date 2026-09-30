import { describe, expect, it } from "vitest";

import {
  contractErrorSchema,
  createEligibleJudgeResultSchema,
  initialSituationInputSchema,
  initialSituationResultSchema,
  judgeInputSchema,
  judgeResultSchema,
  roomRealtimeEventSchema,
} from ".";

describe("contratos estruturados da IA", () => {
  it("valida a geração da situação inicial", () => {
    expect(
      initialSituationInputSchema.safeParse({
        roundNumber: 1,
        storySummary: "",
      }).success,
    ).toBe(true);
    expect(
      initialSituationResultSchema.safeParse({
        situation: "Uma porta apareceu no meio da sala.",
        updatedStorySummary: "Uma porta misteriosa apareceu.",
      }).success,
    ).toBe(true);
    expect(
      initialSituationResultSchema.safeParse({ situation: "Sem resumo." })
        .success,
    ).toBe(false);
  });

  it("valida a entrada do julgamento e rejeita respostas duplicadas", () => {
    const input = {
      roundNumber: 1,
      storySummary: "Uma porta misteriosa apareceu.",
      situation: "A porta começou a falar.",
      wordLimit: 5,
      answers: [
        { playerId: "player-1", text: "Eu pergunto o nome dela." },
        { playerId: "player-2", text: "Eu corro para bem longe." },
      ],
    };

    expect(judgeInputSchema.safeParse(input).success).toBe(true);
    expect(
      judgeInputSchema.safeParse({ ...input, answers: [input.answers[0]] })
        .success,
    ).toBe(false);
    expect(
      judgeInputSchema.safeParse({
        ...input,
        answers: [input.answers[0], input.answers[0]],
      }).success,
    ).toBe(false);
  });

  it("aceita JudgeResult estruturado e rejeita campos ausentes", () => {
    const result = {
      winnerPlayerId: "player-1",
      reason: "A resposta interagiu melhor com a situação.",
      continuation: "A porta respondeu com um nome esquecido.",
      nextSituation: "O nome fez as paredes tremerem.",
      updatedStorySummary: "A porta revelou um nome capaz de abalar a sala.",
    };

    expect(judgeResultSchema.safeParse(result).success).toBe(true);
    expect(
      judgeResultSchema.safeParse({
        winnerPlayerId: "player-1",
        reason: "Faltam os demais campos.",
      }).success,
    ).toBe(false);
  });

  it("permite que a IA escolha somente um jogador elegível", () => {
    const schema = createEligibleJudgeResultSchema(["player-1", "player-2"]);
    const result = {
      winnerPlayerId: "player-1",
      reason: "A resposta interagiu melhor com a situação.",
      continuation: "A porta respondeu com um nome esquecido.",
      nextSituation: "O nome fez as paredes tremerem.",
      updatedStorySummary: "A porta revelou um nome capaz de abalar a sala.",
    };

    expect(schema.safeParse(result).success).toBe(true);
    expect(
      schema.safeParse({ ...result, winnerPlayerId: "player-3" }).success,
    ).toBe(false);
  });
});

describe("contrato Realtime", () => {
  it("transporta somente uma notificação para recarregar o estado canônico", () => {
    const event = { type: "room_state_changed", roomCode: "ABC123" };

    expect(roomRealtimeEventSchema.parse(event)).toEqual(event);
    expect(
      roomRealtimeEventSchema.safeParse({
        ...event,
        state: { status: "answering" },
      }).success,
    ).toBe(false);
  });
});

describe("erros compartilhados", () => {
  it.each([
    {
      code: "validation_error",
      message: "Payload inválido.",
      issues: [{ path: ["playerName"], message: "Nome obrigatório." }],
    },
    { code: "authorization_error", message: "Token inválido." },
    {
      code: "phase_conflict",
      message: "Operação incompatível com a fase.",
      currentStatus: "answering",
      expectedStatuses: ["waiting"],
    },
    {
      code: "external_unavailable",
      message: "A IA está temporariamente indisponível.",
      retryable: true,
    },
  ])("aceita o erro $code", (error) => {
    expect(contractErrorSchema.safeParse(error).success).toBe(true);
  });

  it("rejeita uma categoria de erro desconhecida", () => {
    expect(
      contractErrorSchema.safeParse({ code: "unknown", message: "Erro." })
        .success,
    ).toBe(false);
  });
});
