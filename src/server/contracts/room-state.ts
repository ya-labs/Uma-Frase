import "server-only";

import { z } from "zod";

import {
  MAX_PLAYERS,
  answerSchema,
  gameSchema,
  playerSchema,
  roundSchema,
} from "@/domain/game";

export const serverRoomStateSchema = z
  .object({
    game: gameSchema,
    players: z.array(playerSchema).min(1).max(MAX_PLAYERS),
    currentRound: roundSchema.nullable(),
    answers: z.array(answerSchema).max(MAX_PLAYERS),
    control: z
      .object({
        revision: z.number().int().nonnegative(),
        canRetry: z.boolean(),
        workError: z.boolean(),
        epilogue: z.string().max(4000).nullable(),
        suggestedSituation: z.string().max(2000).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ServerRoomState = z.infer<typeof serverRoomStateSchema>;
