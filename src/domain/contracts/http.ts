import { z } from "zod";

import { contractErrorResponseSchema } from "./errors";
import { roomStateSchema } from "./state";

const roomCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{8}$/, "Código de sala inválido.");
const playerTokenSchema = z.string().trim().min(32).max(256);
const playerNameSchema = z.string().trim().min(1).max(80);
const identifierSchema = z.string().trim().min(1);

const authenticatedRoomCommandShape = {
  roomCode: roomCodeSchema,
  playerToken: playerTokenSchema,
};

export const createRoomCommandSchema = z
  .object({
    playerName: playerNameSchema,
    playerToken: playerTokenSchema.optional(),
  })
  .strict();

export const joinRoomCommandSchema = z
  .object({
    roomCode: roomCodeSchema,
    playerName: playerNameSchema,
    playerToken: playerTokenSchema.optional(),
  })
  .strict();

export const startRoomCommandSchema = z
  .object(authenticatedRoomCommandShape)
  .strict();

export const getRoomStateCommandSchema = z
  .object(authenticatedRoomCommandShape)
  .strict();

export const setRoomPresenceCommandSchema = z
  .object({
    ...authenticatedRoomCommandShape,
    isConnected: z.boolean(),
  })
  .strict();

export const submitAnswerCommandSchema = z
  .object({
    ...authenticatedRoomCommandShape,
    roundId: identifierSchema,
    text: z.string().trim().min(1).max(2000),
  })
  .strict();

export const resolveRoomCommandSchema = z
  .object({
    ...authenticatedRoomCommandShape,
    roundId: identifierSchema,
  })
  .strict();

export const pauseRoomCommandSchema = z
  .object(authenticatedRoomCommandShape)
  .strict();

export const resumeRoomCommandSchema = z
  .object(authenticatedRoomCommandShape)
  .strict();

const roomSessionSchema = z
  .object({
    playerToken: playerTokenSchema,
    state: roomStateSchema,
  })
  .strict();

const roomStateResultSchema = z.object({ state: roomStateSchema }).strict();

function operationResponseSchema<TSchema extends z.ZodType>(
  dataSchema: TSchema,
) {
  return z.union([
    z.object({ ok: z.literal(true), data: dataSchema }).strict(),
    contractErrorResponseSchema,
  ]);
}

export const createRoomResponseSchema =
  operationResponseSchema(roomSessionSchema);
export const joinRoomResponseSchema =
  operationResponseSchema(roomSessionSchema);
export const startRoomResponseSchema = operationResponseSchema(
  roomStateResultSchema,
);
export const getRoomStateResponseSchema = operationResponseSchema(
  roomStateResultSchema,
);
export const setRoomPresenceResponseSchema = operationResponseSchema(
  roomStateResultSchema,
);
export const submitAnswerResponseSchema = operationResponseSchema(
  roomStateResultSchema,
);
export const resolveRoomResponseSchema = operationResponseSchema(
  roomStateResultSchema,
);
export const pauseRoomResponseSchema = operationResponseSchema(
  roomStateResultSchema,
);
export const resumeRoomResponseSchema = operationResponseSchema(
  roomStateResultSchema,
);

export const roomHttpContracts = {
  create: {
    method: "POST",
    path: "/api/rooms",
    commandSchema: createRoomCommandSchema,
    responseSchema: createRoomResponseSchema,
  },
  join: {
    method: "POST",
    path: "/api/rooms/:code/join",
    commandSchema: joinRoomCommandSchema,
    responseSchema: joinRoomResponseSchema,
  },
  start: {
    method: "POST",
    path: "/api/rooms/:code/start",
    commandSchema: startRoomCommandSchema,
    responseSchema: startRoomResponseSchema,
  },
  state: {
    method: "GET",
    path: "/api/rooms/:code/state",
    commandSchema: getRoomStateCommandSchema,
    responseSchema: getRoomStateResponseSchema,
  },
  presence: {
    method: "POST",
    path: "/api/rooms/:code/presence",
    commandSchema: setRoomPresenceCommandSchema,
    responseSchema: setRoomPresenceResponseSchema,
  },
  answer: {
    method: "POST",
    path: "/api/rooms/:code/answer",
    commandSchema: submitAnswerCommandSchema,
    responseSchema: submitAnswerResponseSchema,
  },
  resolve: {
    method: "POST",
    path: "/api/rooms/:code/resolve",
    commandSchema: resolveRoomCommandSchema,
    responseSchema: resolveRoomResponseSchema,
  },
  pause: {
    method: "POST",
    path: "/api/rooms/:code/pause",
    commandSchema: pauseRoomCommandSchema,
    responseSchema: pauseRoomResponseSchema,
  },
  resume: {
    method: "POST",
    path: "/api/rooms/:code/resume",
    commandSchema: resumeRoomCommandSchema,
    responseSchema: resumeRoomResponseSchema,
  },
} as const;

export type CreateRoomCommand = z.infer<typeof createRoomCommandSchema>;
export type JoinRoomCommand = z.infer<typeof joinRoomCommandSchema>;
export type StartRoomCommand = z.infer<typeof startRoomCommandSchema>;
export type GetRoomStateCommand = z.infer<typeof getRoomStateCommandSchema>;
export type SetRoomPresenceCommand = z.infer<
  typeof setRoomPresenceCommandSchema
>;
export type SubmitAnswerCommand = z.infer<typeof submitAnswerCommandSchema>;
export type ResolveRoomCommand = z.infer<typeof resolveRoomCommandSchema>;
export type PauseRoomCommand = z.infer<typeof pauseRoomCommandSchema>;
export type ResumeRoomCommand = z.infer<typeof resumeRoomCommandSchema>;
export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;
export type JoinRoomResponse = z.infer<typeof joinRoomResponseSchema>;
export type StartRoomResponse = z.infer<typeof startRoomResponseSchema>;
export type GetRoomStateResponse = z.infer<typeof getRoomStateResponseSchema>;
export type SetRoomPresenceResponse = z.infer<
  typeof setRoomPresenceResponseSchema
>;
export type SubmitAnswerResponse = z.infer<typeof submitAnswerResponseSchema>;
export type ResolveRoomResponse = z.infer<typeof resolveRoomResponseSchema>;
export type PauseRoomResponse = z.infer<typeof pauseRoomResponseSchema>;
export type ResumeRoomResponse = z.infer<typeof resumeRoomResponseSchema>;
