import "server-only";

import { z } from "zod";

import {
  createRoomCommandSchema,
  getRoomStateCommandSchema,
  joinRoomCommandSchema,
  setRoomPresenceCommandSchema,
  startRoomCommandSchema,
  type ContractError,
  type CreateRoomCommand,
  type JoinRoomCommand,
  type RoomState,
  type SetRoomPresenceCommand,
  type StartRoomCommand,
} from "@/domain/contracts";
import { getRoomService, RoomServiceError } from "@/server/rooms";

export interface RoomServicePort {
  create(command: CreateRoomCommand): Promise<{
    playerToken: string;
    state: RoomState;
  }>;
  join(command: JoinRoomCommand): Promise<{
    playerToken: string;
    state: RoomState;
  }>;
  getState(roomCode: string, playerToken: string): Promise<RoomState>;
  start(command: StartRoomCommand): Promise<RoomState>;
  setPresence(command: SetRoomPresenceCommand): Promise<RoomState>;
}

type RoomRouteContext = { params: Promise<{ code: string }> };

export function validationError(error: z.ZodError): Response {
  const contractError: ContractError = {
    code: "validation_error",
    message: "A requisição possui dados inválidos.",
    issues: error.issues.map((issue) => ({
      path: issue.path.filter(
        (part): part is string | number =>
          typeof part === "string" || typeof part === "number",
      ),
      message: issue.message,
    })),
  };

  return Response.json({ ok: false, error: contractError }, { status: 400 });
}

export function operationError(error: unknown): Response {
  if (error instanceof RoomServiceError) {
    return Response.json(
      { ok: false, error: error.contractError },
      { status: error.status },
    );
  }

  return Response.json(
    {
      ok: false,
      error: {
        code: "external_unavailable",
        message: "A operação da sala falhou inesperadamente.",
        retryable: true,
      },
    },
    { status: 503 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function withRoomCode(
  body: unknown,
  roomCode: string,
): Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { roomCode };
  }

  return { ...body, roomCode };
}

export async function handleCreateRoom(
  request: Request,
  service: RoomServicePort = getRoomService(),
): Promise<Response> {
  const body = await readJson(request);
  const playerToken =
    bearerToken(request) ??
    (typeof body === "object" && body !== null && "playerToken" in body
      ? body.playerToken
      : undefined);
  const command = createRoomCommandSchema.safeParse({
    ...(typeof body === "object" && body !== null ? body : {}),
    ...(playerToken === undefined ? {} : { playerToken }),
  });
  if (!command.success) return validationError(command.error);

  try {
    const data = await service.create(command.data);
    return Response.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    return operationError(error);
  }
}

export async function handleJoinRoom(
  request: Request,
  context: RoomRouteContext,
  service: RoomServicePort = getRoomService(),
): Promise<Response> {
  const { code } = await context.params;
  const body = await readJson(request);
  const playerToken =
    bearerToken(request) ??
    (typeof body === "object" && body !== null && "playerToken" in body
      ? body.playerToken
      : undefined);
  const command = joinRoomCommandSchema.safeParse({
    ...withRoomCode(body, code),
    ...(playerToken === undefined ? {} : { playerToken }),
  });
  if (!command.success) return validationError(command.error);

  try {
    const data = await service.join(command.data);
    return Response.json({ ok: true, data });
  } catch (error) {
    return operationError(error);
  }
}

export async function handleGetRoomState(
  request: Request,
  context: RoomRouteContext,
  service: RoomServicePort = getRoomService(),
): Promise<Response> {
  const { code } = await context.params;
  const command = getRoomStateCommandSchema.safeParse({
    roomCode: code,
    playerToken: bearerToken(request),
  });
  if (!command.success) return validationError(command.error);

  try {
    const state = await service.getState(
      command.data.roomCode,
      command.data.playerToken,
    );
    return Response.json({ ok: true, data: { state } });
  } catch (error) {
    return operationError(error);
  }
}

export async function handleStartRoom(
  request: Request,
  context: RoomRouteContext,
  service: RoomServicePort = getRoomService(),
): Promise<Response> {
  const { code } = await context.params;
  const body = await readJson(request);
  const command = startRoomCommandSchema.safeParse({
    ...withRoomCode(body, code),
    playerToken:
      bearerToken(request) ??
      (typeof body === "object" && body !== null && "playerToken" in body
        ? body.playerToken
        : undefined),
  });
  if (!command.success) return validationError(command.error);

  try {
    const state = await service.start(command.data);
    return Response.json({ ok: true, data: { state } });
  } catch (error) {
    return operationError(error);
  }
}

export async function handleSetRoomPresence(
  request: Request,
  context: RoomRouteContext,
  service: RoomServicePort = getRoomService(),
): Promise<Response> {
  const { code } = await context.params;
  const body = await readJson(request);
  const command = setRoomPresenceCommandSchema.safeParse({
    ...withRoomCode(body, code),
    playerToken:
      bearerToken(request) ??
      (typeof body === "object" && body !== null && "playerToken" in body
        ? body.playerToken
        : undefined),
  });
  if (!command.success) return validationError(command.error);

  try {
    const state = await service.setPresence(command.data);
    return Response.json({ ok: true, data: { state } });
  } catch (error) {
    return operationError(error);
  }
}
