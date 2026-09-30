import { z } from "zod";

import { gameStatusSchema } from "../game";

const messageSchema = z.string().trim().min(1);

export const validationIssueSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number().int()])),
    message: messageSchema,
  })
  .strict();

const validationErrorSchema = z
  .object({
    code: z.literal("validation_error"),
    message: messageSchema,
    issues: z.array(validationIssueSchema).min(1),
  })
  .strict();

const authorizationErrorSchema = z
  .object({
    code: z.literal("authorization_error"),
    message: messageSchema,
  })
  .strict();

const phaseConflictErrorSchema = z
  .object({
    code: z.literal("phase_conflict"),
    message: messageSchema,
    currentStatus: gameStatusSchema,
    expectedStatuses: z.array(gameStatusSchema).min(1),
  })
  .strict();

const externalUnavailableErrorSchema = z
  .object({
    code: z.literal("external_unavailable"),
    message: messageSchema,
    retryable: z.boolean(),
  })
  .strict();

export const contractErrorSchema = z.discriminatedUnion("code", [
  validationErrorSchema,
  authorizationErrorSchema,
  phaseConflictErrorSchema,
  externalUnavailableErrorSchema,
]);

export const contractErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: contractErrorSchema,
  })
  .strict();

export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ContractError = z.infer<typeof contractErrorSchema>;
export type ContractErrorResponse = z.infer<typeof contractErrorResponseSchema>;
