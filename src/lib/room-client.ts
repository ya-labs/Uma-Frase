import type { z } from "zod";

import {
  createRoomResponseSchema,
  getRoomStateResponseSchema,
  joinRoomResponseSchema,
  startRoomResponseSchema,
  submitAnswerResponseSchema,
  setRoomPresenceResponseSchema,
  advanceRoomResponseSchema,
  retryRoomResponseSchema,
  type ContractError,
  type ContractErrorResponse,
  type CreateRoomCommand,
  type CreateRoomResponse,
  type GetRoomStateResponse,
  type JoinRoomCommand,
  type SubmitAnswerResponse,
} from "@/domain";

type RoomSession = Extract<CreateRoomResponse, { ok: true }>["data"];
type RoomStateResult = Extract<GetRoomStateResponse, { ok: true }>["data"];
type SubmitAnswerResult = Extract<SubmitAnswerResponse, { ok: true }>["data"];
type OperationResponse<TData> =
  { ok: true; data: TData } | ContractErrorResponse;

export type RoomClientErrorKind =
  | "validation"
  | "authorization"
  | "conflict"
  | "unavailable"
  | "network"
  | "invalid_response";

export class RoomClientError extends Error {
  readonly kind: RoomClientErrorKind;
  readonly retryable: boolean;

  constructor(kind: RoomClientErrorKind, message: string, retryable = false) {
    super(message);
    this.name = "RoomClientError";
    this.kind = kind;
    this.retryable = retryable;
  }
}

export type RoomClient = {
  createRoom(command: CreateRoomCommand): Promise<RoomSession>;
  joinRoom(command: JoinRoomCommand): Promise<RoomSession>;
  getRoomState(roomCode: string, playerToken: string): Promise<RoomStateResult>;
  startRoom(roomCode: string, playerToken: string): Promise<RoomStateResult>;
  setPresence(
    roomCode: string,
    playerToken: string,
    isConnected: boolean,
  ): Promise<RoomStateResult>;
  advanceRoom(
    roomCode: string,
    playerToken: string,
    roundId: string,
  ): Promise<RoomStateResult>;
  retryNarrative(
    roomCode: string,
    playerToken: string,
  ): Promise<RoomStateResult>;
  submitAnswer(
    roomCode: string,
    playerToken: string,
    roundId: string,
    text: string,
  ): Promise<SubmitAnswerResult>;
};

type RoomClientOptions = {
  fetch?: typeof fetch;
};

function mapContractError(error: ContractError) {
  switch (error.code) {
    case "validation_error":
      return new RoomClientError(
        "validation",
        "Revise os dados informados e tente novamente.",
      );
    case "authorization_error":
      return new RoomClientError(
        "authorization",
        "Sua identificação nesta sala não é válida. Entre novamente.",
      );
    case "phase_conflict":
      return new RoomClientError(
        "conflict",
        "A sala mudou de estado. Atualize e tente novamente.",
        true,
      );
    case "external_unavailable":
      return new RoomClientError(
        "unavailable",
        "O serviço está temporariamente indisponível. Tente novamente.",
        error.retryable,
      );
  }
}

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function createRoomClient({
  fetch: fetchImpl = fetch,
}: RoomClientOptions = {}): RoomClient {
  async function request<TData>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<OperationResponse<TData>>,
  ): Promise<TData> {
    let response: Response;

    try {
      response = await fetchImpl(path, init);
    } catch {
      throw new RoomClientError(
        "network",
        "Não foi possível conectar à sala. Verifique sua conexão e tente novamente.",
        true,
      );
    }

    const parsed = schema.safeParse(await readJson(response));

    if (parsed.success && !parsed.data.ok) {
      throw mapContractError(parsed.data.error);
    }

    if (!response.ok || !parsed.success || !parsed.data.ok) {
      throw new RoomClientError(
        "invalid_response",
        "A sala respondeu de forma inesperada. Tente novamente.",
        true,
      );
    }

    return parsed.data.data;
  }

  function authenticatedHeaders(playerToken: string) {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${playerToken}`,
    };
  }

  return {
    createRoom(command) {
      return request(
        "/api/rooms",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(command),
        },
        createRoomResponseSchema,
      );
    },

    joinRoom(command) {
      return request(
        `/api/rooms/${encodeURIComponent(command.roomCode)}/join`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ playerName: command.playerName }),
        },
        joinRoomResponseSchema,
      );
    },

    getRoomState(roomCode, playerToken) {
      return request(
        `/api/rooms/${encodeURIComponent(roomCode)}/state`,
        {
          method: "GET",
          headers: authenticatedHeaders(playerToken),
          cache: "no-store",
        },
        getRoomStateResponseSchema,
      );
    },

    startRoom(roomCode, playerToken) {
      return request(
        `/api/rooms/${encodeURIComponent(roomCode)}/start`,
        {
          method: "POST",
          headers: authenticatedHeaders(playerToken),
        },
        startRoomResponseSchema,
      );
    },

    setPresence(roomCode, playerToken, isConnected) {
      return request(
        `/api/rooms/${encodeURIComponent(roomCode)}/presence`,
        {
          method: "POST",
          headers: {
            ...authenticatedHeaders(playerToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ isConnected }),
          keepalive: !isConnected,
        },
        setRoomPresenceResponseSchema,
      );
    },
    advanceRoom(roomCode, playerToken, roundId) {
      return request(
        `/api/rooms/${encodeURIComponent(roomCode)}/advance`,
        {
          method: "POST",
          headers: {
            ...authenticatedHeaders(playerToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roundId }),
        },
        advanceRoomResponseSchema,
      );
    },
    retryNarrative(roomCode, playerToken) {
      return request(
        `/api/rooms/${encodeURIComponent(roomCode)}/retry`,
        {
          method: "POST",
          headers: authenticatedHeaders(playerToken),
        },
        retryRoomResponseSchema,
      );
    },

    submitAnswer(roomCode, playerToken, roundId, text) {
      return request(
        `/api/rooms/${encodeURIComponent(roomCode)}/answer`,
        {
          method: "POST",
          headers: {
            ...authenticatedHeaders(playerToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ roundId, text }),
        },
        submitAnswerResponseSchema,
      );
    },
  };
}
