import { z } from "zod";

import {
  MAX_PLAYERS,
  MAX_ROUNDS,
  gameStatusSchema,
  pausableGameStatusSchema,
  wordLimitSchema,
} from "../game";

const identifierSchema = z.string().trim().min(1);
const roomCodeSchema = z.string().trim().min(1);
const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const publicPlayerStateSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(1),
    score: z.number().int().min(0).max(MAX_ROUNDS),
    isConnected: z.boolean(),
    hasAnswered: z.boolean(),
  })
  .strict();

export const publicAnswerSchema = z
  .object({
    playerId: identifierSchema,
    text: z.string().trim().min(1),
  })
  .strict();

export const publicRoundStateSchema = z
  .object({
    id: identifierSchema,
    number: z.number().int().min(1).max(MAX_ROUNDS),
    situation: z.string(),
    wordLimit: wordLimitSchema.nullable(),
    answerDeadlineAt: isoDateTimeSchema.nullable(),
    winnerPlayerId: identifierSchema.nullable(),
    reason: z.string().nullable(),
    continuation: z.string().nullable(),
    nextSituation: z.string().nullable(),
    answers: z.array(publicAnswerSchema).max(MAX_PLAYERS).optional(),
  })
  .strict();

const publicGameStateSchema = z
  .object({
    id: identifierSchema,
    code: roomCodeSchema,
    status: gameStatusSchema,
    round: z.number().int().min(0).max(MAX_ROUNDS),
    maxRounds: z.literal(MAX_ROUNDS),
    pausedFrom: pausableGameStatusSchema.nullable(),
    storySummary: z.string().max(6000).optional(),
    epilogue: z.string().max(4000).optional(),
  })
  .strict();

export const publicRoomStateSchema = z
  .object({
    game: publicGameStateSchema,
    players: z
      .array(publicPlayerStateSchema)
      .min(1)
      .max(MAX_PLAYERS)
      .superRefine((players, context) => {
        const playerIds = players.map((player) => player.id);

        if (new Set(playerIds).size !== playerIds.length) {
          context.addIssue({
            code: "custom",
            message: "O estado público não pode possuir jogadores duplicados.",
          });
        }
      }),
    currentRound: publicRoundStateSchema.nullable(),
    control: z
      .object({
        revision: z.number().int().nonnegative(),
        canRetry: z.boolean(),
        workError: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((state, context) => {
    const revealIsPublic =
      state.game.status === "reveal" ||
      state.game.status === "finished" ||
      (state.game.status === "paused" && state.game.pausedFrom === "reveal");
    const round = state.currentRound;

    if (state.game.status === "paused" && state.game.pausedFrom === null) {
      context.addIssue({
        code: "custom",
        path: ["game", "pausedFrom"],
        message: "Uma partida pausada deve informar a fase anterior.",
      });
    }

    if (state.game.status !== "paused" && state.game.pausedFrom !== null) {
      context.addIssue({
        code: "custom",
        path: ["game", "pausedFrom"],
        message: "A fase anterior só pode existir durante uma pausa.",
      });
    }

    if (!round) return;

    const resultFieldsAreHidden =
      round.winnerPlayerId === null &&
      round.reason === null &&
      round.continuation === null &&
      round.nextSituation === null;

    if (
      !revealIsPublic &&
      (!resultFieldsAreHidden || round.answers !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["currentRound"],
        message:
          "Respostas e resultado da rodada só podem aparecer durante a revelação.",
      });
    }

    if (revealIsPublic && round.answers === undefined) {
      context.addIssue({
        code: "custom",
        path: ["currentRound", "answers"],
        message: "A revelação deve informar as respostas públicas da rodada.",
      });
    }

    const publicPlayerIds = new Set(state.players.map((player) => player.id));

    if (
      round.winnerPlayerId !== null &&
      !publicPlayerIds.has(round.winnerPlayerId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["currentRound", "winnerPlayerId"],
        message: "O vencedor público deve pertencer à sala.",
      });
    }
  });

export const privateAnswerStateSchema = z
  .object({
    id: identifierSchema,
    roundId: identifierSchema,
    text: z.string().trim().min(1),
    submittedAt: isoDateTimeSchema,
  })
  .strict();

export const privatePlayerStateSchema = z
  .object({
    playerId: identifierSchema,
    isHost: z.boolean(),
    answer: privateAnswerStateSchema.nullable(),
  })
  .strict();

export const roomStateSchema = z
  .object({
    public: publicRoomStateSchema,
    private: privatePlayerStateSchema,
  })
  .strict()
  .superRefine((state, context) => {
    if (
      !state.public.players.some(
        (player) => player.id === state.private.playerId,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["private", "playerId"],
        message: "O estado privado deve pertencer a um jogador da sala.",
      });
    }

    if (
      state.private.answer !== null &&
      state.public.currentRound !== null &&
      state.private.answer.roundId !== state.public.currentRound.id
    ) {
      context.addIssue({
        code: "custom",
        path: ["private", "answer", "roundId"],
        message: "A resposta privada deve pertencer à rodada atual.",
      });
    }
  });

export type PublicPlayerState = z.infer<typeof publicPlayerStateSchema>;
export type PublicAnswer = z.infer<typeof publicAnswerSchema>;
export type PublicRoundState = z.infer<typeof publicRoundStateSchema>;
export type PublicRoomState = z.infer<typeof publicRoomStateSchema>;
export type PrivateAnswerState = z.infer<typeof privateAnswerStateSchema>;
export type PrivatePlayerState = z.infer<typeof privatePlayerStateSchema>;
export type RoomState = z.infer<typeof roomStateSchema>;
