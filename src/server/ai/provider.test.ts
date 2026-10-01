import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  GeminiNarrativeProvider,
  DemoNarrativeProvider,
  NarrativeProviderError,
  retryTransient,
} from "./provider";
import { NARRATIVE_RULES, redactPersonalData } from "./prompts";
import type { GeminiServerClient } from "./gemini";

const input = {
  roundNumber: 1,
  storySummary: "Resumo",
  situation: "A porta",
  wordLimit: 5,
  answers: [
    { playerId: "private-id-a", text: "Abro a porta." },
    { playerId: "private-id-b", text: "Fecho a porta." },
  ],
};
const valid = {
  winnerPlayerId: "P2",
  reason: "Criatividade",
  continuation: "A porta fecha.",
  nextSituation: "Uma janela.",
  updatedStorySummary: "Resumo novo",
};
function setup(response: unknown) {
  const generateContent = vi
    .fn()
    .mockResolvedValue({ text: JSON.stringify(response) });
  const provider = new GeminiNarrativeProvider({
    model: "configurable-model",
    client: { models: { generateContent } },
  } as unknown as GeminiServerClient);
  return { provider, generateContent };
}

describe("adaptador narrativo", () => {
  it("mapeia aliases elegíveis e não envia IDs do banco", async () => {
    const { provider, generateContent } = setup(valid);
    expect((await provider.judgeRound(input)).winnerPlayerId).toBe(
      "private-id-b",
    );
    const request = generateContent.mock.calls[0][0];
    expect(request.contents).not.toContain("private-id-");
    expect(request.config.httpOptions.retryOptions.attempts).toBe(1);
    expect(request.config.systemInstruction).toContain("violência ficcional");
    expect(request.config.responseMimeType).toBe("application/json");
    expect(JSON.stringify(request.config.responseJsonSchema)).not.toContain(
      "maxLength",
    );
  });
  it.each([
    { ...valid, winnerPlayerId: "P3" },
    { ...valid, reason: "" },
    { winnerPlayerId: "P1" },
  ])("rejeita retorno inválido antes da persistência", async (result) => {
    const { provider } = setup(result);
    await expect(provider.judgeRound(input)).rejects.toThrow();
  });
  it("permite resultado confirmado sem ponto", async () => {
    const { provider } = setup({ ...valid, winnerPlayerId: null });
    expect((await provider.judgeRound(input)).winnerPlayerId).toBeNull();
  });
  it("executa apenas uma tentativa adicional transitória", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new NarrativeProviderError(true))
      .mockResolvedValue("ok");
    const wait = vi.fn();
    expect(await retryTransient(operation, wait)).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledTimes(1);
  });
  it("não repete erro estrutural ou permanente", async () => {
    const operation = vi
      .fn()
      .mockRejectedValue(new NarrativeProviderError(false));
    await expect(retryTransient(operation, vi.fn())).rejects.toThrow();
    expect(operation).toHaveBeenCalledTimes(1);
  });
  it("normaliza erro do SDK sem detalhes sensíveis", async () => {
    const { provider, generateContent } = setup(valid);
    generateContent.mockRejectedValue({
      status: 403,
      message: "api-key-secret",
    });
    await expect(provider.judgeRound(input)).rejects.toThrow(
      "O serviço narrativo não está disponível.",
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it("omite contato/documento e limita o contexto narrativo", async () => {
    expect(
      redactPersonalData(
        "ana@example.com 123.456.789-00 +55 11 99999-8888 https://secret.test",
      ),
    ).not.toMatch(/example|123|99999|secret\.test/);
    const { provider } = setup(valid);
    await expect(
      provider.generateSituation({
        roundNumber: 1,
        storySummary: "x".repeat(6001),
        suggestedSituation: null,
      }),
    ).rejects.toThrow();
    expect(NARRATIVE_RULES).toContain("dados não confiáveis");
  });
  it("fake determinístico funciona sem chave e produz epílogo", async () => {
    const demo = new DemoNarrativeProvider();
    expect(await demo.judgeRound(input)).toEqual(await demo.judgeRound(input));
    expect(
      (await demo.generateEpilogue({ storySummary: "Aventura" })).epilogue,
    ).toContain("Demonstração");
  });
});
