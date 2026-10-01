import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { serverRoomStateSchema, type ServerRoomState } from "../contracts";

const roomSnapshotSchema = z
  .object({
    playerId: z.string().trim().min(1),
    state: serverRoomStateSchema,
  })
  .strict();

export type RoomSnapshot = {
  playerId: string;
  state: ServerRoomState;
};

export type RoomRepositoryErrorKind =
  "not_found" | "authorization" | "conflict" | "collision" | "unavailable";

export class RoomRepositoryError extends Error {
  constructor(
    readonly kind: RoomRepositoryErrorKind,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RoomRepositoryError";
  }
}

export interface RoomRepository {
  createRoom(
    code: string,
    playerName: string,
    tokenHash: string,
  ): Promise<string>;
  joinRoom(code: string, playerName: string, tokenHash: string): Promise<void>;
  startRoom(code: string, tokenHash: string): Promise<void>;
  setPresence(
    code: string,
    tokenHash: string,
    isConnected: boolean,
  ): Promise<void>;
  getSnapshot(code: string, tokenHash: string): Promise<RoomSnapshot>;
}

type PostgrestError = {
  code?: string;
  message?: string;
};

export function repositoryError(error: PostgrestError): RoomRepositoryError {
  const message = error.message ?? "A operação da sala falhou.";

  if (error.code === "P0002") {
    return new RoomRepositoryError("not_found", message);
  }

  if (error.code === "42501") {
    return new RoomRepositoryError("authorization", message);
  }

  if (error.code === "23505") {
    return new RoomRepositoryError("collision", message);
  }

  if (error.code === "23514" || error.code === "P0001") {
    return new RoomRepositoryError("conflict", message);
  }

  return new RoomRepositoryError("unavailable", message);
}

export class SupabaseRoomRepository implements RoomRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createRoom(
    code: string,
    playerName: string,
    tokenHash: string,
  ): Promise<string> {
    const { data, error } = await this.client.rpc("create_room_with_host", {
      p_code: code,
      p_host_name: playerName,
      p_token_hash: tokenHash,
    });

    if (error) throw repositoryError(error);

    const result = z
      .array(z.object({ room_code: z.string().trim().min(1) }))
      .min(1)
      .safeParse(data);

    if (!result.success) {
      throw new RoomRepositoryError(
        "unavailable",
        "O banco não confirmou o código da sala criada.",
        { cause: result.error },
      );
    }

    return result.data[0].room_code;
  }

  async joinRoom(
    code: string,
    playerName: string,
    tokenHash: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("join_game", {
      p_code: code,
      p_player_name: playerName,
      p_token_hash: tokenHash,
    });

    if (error) throw repositoryError(error);
  }

  async startRoom(code: string, tokenHash: string): Promise<void> {
    const { error } = await this.client.rpc("start_game", {
      p_code: code,
      p_token_hash: tokenHash,
    });

    if (error) throw repositoryError(error);
  }

  async setPresence(
    code: string,
    tokenHash: string,
    isConnected: boolean,
  ): Promise<void> {
    const { error } = await this.client.rpc("update_player_presence", {
      p_code: code,
      p_token_hash: tokenHash,
      p_is_connected: isConnected,
    });

    if (error) throw repositoryError(error);
  }

  async getSnapshot(code: string, tokenHash: string): Promise<RoomSnapshot> {
    const { data, error } = await this.client.rpc("get_room_snapshot", {
      p_code: code,
      p_token_hash: tokenHash,
    });

    if (error) throw repositoryError(error);

    const parsed = roomSnapshotSchema.safeParse(data);

    if (!parsed.success) {
      throw new RoomRepositoryError(
        "unavailable",
        "O banco retornou um estado de sala inválido.",
        { cause: parsed.error },
      );
    }

    return parsed.data;
  }
}
