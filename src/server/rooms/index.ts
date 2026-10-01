import "server-only";

import { createSupabaseAdminClient } from "../supabase";
import { SupabaseRoomRepository } from "./repository";
import { RoundService } from "../rounds/service";
import { SupabaseRoundRepository } from "../rounds/repository";

let roomService: RoundService | undefined;

export function getRoomService(): RoundService {
  roomService ??= new RoundService(
    new SupabaseRoomRepository(createSupabaseAdminClient()),
    new SupabaseRoundRepository(createSupabaseAdminClient()),
  );

  return roomService;
}

export * from "./identity";
export * from "./repository";
export * from "./service";
export * from "./state";
