import { z } from "zod";

import {
  GAME_STATUSES,
  MAX_ROUNDS,
  MAX_WORD_LIMIT,
  MIN_WORD_LIMIT,
  PAUSABLE_GAME_STATUSES,
  type Answer,
  type Game,
  type Player,
  type Round,
} from "./entities";

export const gameStatusSchema = z.enum(GAME_STATUSES);
export const pausableGameStatusSchema = z.enum(PAUSABLE_GAME_STATUSES);

const identifierSchema = z.string().trim().min(1);
const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const wordLimitSchema = z
  .number()
  .int()
  .min(MIN_WORD_LIMIT)
  .max(MAX_WORD_LIMIT);

export const gameSchema: z.ZodType<Game> = z.object({
  id: identifierSchema,
  code: z.string().trim().min(1),
  status: gameStatusSchema,
  hostPlayerId: identifierSchema,
  round: z.number().int().min(0).max(MAX_ROUNDS),
  maxRounds: z.literal(MAX_ROUNDS),
  storySummary: z.string(),
  pausedFrom: pausableGameStatusSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const playerSchema: z.ZodType<Player> = z.object({
  id: identifierSchema,
  gameId: identifierSchema,
  name: z.string().trim().min(1),
  score: z.number().int().min(0).max(MAX_ROUNDS),
  isConnected: z.boolean(),
});

export const roundSchema: z.ZodType<Round> = z.object({
  id: identifierSchema,
  gameId: identifierSchema,
  number: z.number().int().min(1).max(MAX_ROUNDS),
  status: gameStatusSchema,
  situation: z.string(),
  wordLimit: wordLimitSchema,
  answerDeadlineAt: isoDateTimeSchema.nullable(),
  winnerPlayerId: identifierSchema.nullable(),
  reason: z.string().nullable(),
  continuation: z.string().nullable(),
  nextSituation: z.string().nullable(),
});

export const answerSchema: z.ZodType<Answer> = z.object({
  id: identifierSchema,
  roundId: identifierSchema,
  playerId: identifierSchema,
  text: z.string(),
  submittedAt: isoDateTimeSchema,
});
