import { z } from "zod";

import { MAX_PLAYERS, MAX_ROUNDS, wordLimitSchema } from "../game";

const identifierSchema = z.string().trim().min(1);
const meaningfulTextSchema = z.string().trim().min(1).max(2000);
const summarySchema = z.string().trim().min(1).max(6000);

export const initialSituationInputSchema = z
  .object({
    roundNumber: z.literal(1),
    storySummary: z.string().max(6000),
  })
  .strict();

export const initialSituationResultSchema = z
  .object({
    situation: meaningfulTextSchema,
    updatedStorySummary: summarySchema,
  })
  .strict();

export const judgeAnswerSchema = z
  .object({
    playerId: identifierSchema,
    text: meaningfulTextSchema,
  })
  .strict();

export const judgeInputSchema = z
  .object({
    roundNumber: z.number().int().min(1).max(MAX_ROUNDS),
    storySummary: z.string().max(6000),
    situation: meaningfulTextSchema,
    wordLimit: wordLimitSchema,
    answers: z
      .array(judgeAnswerSchema)
      .length(MAX_PLAYERS)
      .superRefine((answers, context) => {
        const playerIds = answers.map((answer) => answer.playerId);

        if (new Set(playerIds).size !== playerIds.length) {
          context.addIssue({
            code: "custom",
            message: "Cada jogador pode possuir somente uma resposta julgada.",
          });
        }
      }),
  })
  .strict();

export const judgeResultSchema = z
  .object({
    winnerPlayerId: identifierSchema.nullable(),
    reason: meaningfulTextSchema,
    continuation: meaningfulTextSchema,
    nextSituation: meaningfulTextSchema,
    updatedStorySummary: summarySchema,
  })
  .strict();

export function createEligibleJudgeResultSchema(
  eligiblePlayerIds: readonly string[],
) {
  const eligibleIds = new Set(eligiblePlayerIds);

  return judgeResultSchema.superRefine((result, context) => {
    if (
      result.winnerPlayerId !== null &&
      !eligibleIds.has(result.winnerPlayerId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["winnerPlayerId"],
        message: "O vencedor deve ser um jogador elegível para esta rodada.",
      });
    }
  });
}

export type InitialSituationInput = z.infer<typeof initialSituationInputSchema>;
export type InitialSituationResult = z.infer<
  typeof initialSituationResultSchema
>;
export type JudgeAnswer = z.infer<typeof judgeAnswerSchema>;
export type JudgeInput = z.infer<typeof judgeInputSchema>;
export type JudgeResult = z.infer<typeof judgeResultSchema>;

export const situationInputSchema = z
  .object({
    roundNumber: z.number().int().min(1).max(MAX_ROUNDS),
    storySummary: z.string().max(6000),
    suggestedSituation: z.string().max(2000).nullable(),
  })
  .strict();
export const epilogueInputSchema = z
  .object({ storySummary: summarySchema })
  .strict();
export const epilogueResultSchema = z
  .object({ epilogue: z.string().trim().min(1).max(4000) })
  .strict();
export type SituationInput = z.infer<typeof situationInputSchema>;
export type EpilogueInput = z.infer<typeof epilogueInputSchema>;
export type EpilogueResult = z.infer<typeof epilogueResultSchema>;
