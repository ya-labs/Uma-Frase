import "server-only";

import { HarmBlockThreshold, HarmCategory } from "@google/genai";
import { z } from "zod";
import {
  initialSituationResultSchema,
  judgeInputSchema,
  judgeResultSchema,
  createEligibleJudgeResultSchema,
  situationInputSchema,
  epilogueInputSchema,
  epilogueResultSchema,
  type JudgeInput,
  type JudgeResult,
  type SituationInput,
  type InitialSituationResult,
  type EpilogueInput,
  type EpilogueResult,
} from "@/domain/contracts";
import type { NarrativeProvider } from "./contracts";
import { createGeminiServerClient, type GeminiServerClient } from "./gemini";
import { NARRATIVE_RULES, narrativePrompt } from "./prompts";

export class NarrativeProviderError extends Error {
  constructor(readonly transient: boolean) {
    super("O serviço narrativo não está disponível.");
  }
}

function compatibleJsonSchema(schema: z.ZodType): unknown {
  // Length checks remain local; the provider supports only a JSON Schema subset.
  return JSON.parse(
    JSON.stringify(z.toJSONSchema(schema), (key, value) =>
      ["$schema", "minLength", "maxLength"].includes(key) ? undefined : value,
    ),
  );
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
  wait: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 1000)),
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!(error instanceof NarrativeProviderError) || !error.transient)
      throw error;
    await wait();
    return operation();
  }
}

export class GeminiNarrativeProvider implements NarrativeProvider {
  constructor(
    private readonly gemini: GeminiServerClient = createGeminiServerClient(),
  ) {}

  private async generate<T>(
    schema: z.ZodType<T>,
    task: string,
    context: unknown,
  ): Promise<T> {
    return retryTransient(async () => {
      let text: string | undefined;
      try {
        const response = await this.gemini.client.models.generateContent({
          model: this.gemini.model,
          contents: narrativePrompt(task, context),
          config: {
            systemInstruction: NARRATIVE_RULES,
            responseMimeType: "application/json",
            responseJsonSchema: compatibleJsonSchema(schema),
            maxOutputTokens: 4096,
            httpOptions: { timeout: 20000, retryOptions: { attempts: 1 } },
            safetySettings: [
              {
                category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
              },
              {
                category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
              {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
              },
            ],
          },
        });
        text = response.text;
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : 0;
        const network =
          error instanceof TypeError ||
          (error instanceof Error &&
            ["AbortError", "TimeoutError"].includes(error.name));
        throw new NarrativeProviderError(
          network || [408, 429, 500, 502, 503, 504].includes(status),
        );
      }
      try {
        return schema.parse(JSON.parse(text ?? ""));
      } catch {
        throw new NarrativeProviderError(false);
      }
    });
  }

  async generateSituation(
    input: SituationInput,
  ): Promise<InitialSituationResult> {
    return this.generate(
      initialSituationResultSchema,
      "Crie uma situação curta para a rodada e atualize o resumo. Aproveite a sugestão da rodada anterior sem repeti-la literalmente.",
      situationInputSchema.parse(input),
    );
  }

  async judgeRound(input: JudgeInput): Promise<JudgeResult> {
    const parsed = judgeInputSchema.parse(input);
    // Aliases prevent exposing database identifiers and make provider output easy to validate.
    const answers = parsed.answers.map((answer, index) => ({
      playerId: `P${index + 1}`,
      text: answer.text,
    }));
    const result = await this.generate(
      judgeResultSchema,
      "Escolha uma única resposta vencedora elegível, justifique, continue a história e prepare a próxima situação. null só se ninguém merecer ponto.",
      { ...parsed, answers },
    );
    const validated = createEligibleJudgeResultSchema(
      answers.map((answer) => answer.playerId),
    ).parse(result);
    return {
      ...validated,
      winnerPlayerId:
        validated.winnerPlayerId === null
          ? null
          : parsed.answers[
              answers.findIndex(
                (answer) => answer.playerId === validated.winnerPlayerId,
              )
            ].playerId,
    };
  }

  async generateEpilogue(input: EpilogueInput): Promise<EpilogueResult> {
    return this.generate(
      epilogueResultSchema,
      "Encerre a história das oito rodadas em um epílogo de até 4000 caracteres, sem nova situação nem novo vencedor.",
      epilogueInputSchema.parse(input),
    );
  }
}

// Explicit demo only: never silently replaces an unavailable Gemini credential.
export class DemoNarrativeProvider implements NarrativeProvider {
  async generateSituation(
    input: SituationInput,
  ): Promise<InitialSituationResult> {
    return {
      situation:
        input.suggestedSituation ??
        `Uma porta de luz aparece na estação abandonada. É a etapa ${input.roundNumber} da aventura. O que você faz?`,
      updatedStorySummary:
        input.storySummary ||
        "Dois viajantes encontram uma estação misteriosa.",
    };
  }
  async judgeRound(input: JudgeInput): Promise<JudgeResult> {
    const winner = [...input.answers].sort(
      (a, b) =>
        a.text.localeCompare(b.text, "pt-BR") ||
        a.playerId.localeCompare(b.playerId),
    )[0];
    return {
      winnerPlayerId: winner.playerId,
      reason:
        "Julgamento de demonstração determinístico; não representa avaliação Gemini.",
      continuation: `Os viajantes seguem o plano: ${winner.text}`,
      nextSituation: `Um novo obstáculo surge após a etapa ${input.roundNumber}. Como continuar?`,
      updatedStorySummary:
        `${input.storySummary}\nEtapa ${input.roundNumber}: ${winner.text}`.slice(
          -6000,
        ),
    };
  }
  async generateEpilogue(input: EpilogueInput): Promise<EpilogueResult> {
    return {
      epilogue:
        `Demonstração: a aventura chega ao fim. ${input.storySummary}`.slice(
          0,
          4000,
        ),
    };
  }
}

export function createNarrativeProvider(): NarrativeProvider {
  return process.env.UMA_FRASE_AI_PROVIDER === "demo"
    ? new DemoNarrativeProvider()
    : new GeminiNarrativeProvider();
}
