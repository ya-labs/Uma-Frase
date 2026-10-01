import "server-only";

import { createSupabaseAdminClient } from "../supabase";
import { SupabaseRoomRepository } from "./repository";
import { NarrativeService } from "../rounds/narrative-service";
import { SupabaseRoundRepository } from "../rounds/repository";
import { SupabaseNarrativeRepository } from "../rounds/narrative-repository";
import { createNarrativeProvider } from "../ai/provider";

let roomService: NarrativeService | undefined;

export function getRoomService(): NarrativeService {
  roomService ??= new NarrativeService(
    new SupabaseRoomRepository(createSupabaseAdminClient()),
    new SupabaseRoundRepository(createSupabaseAdminClient()),
    new SupabaseNarrativeRepository(createSupabaseAdminClient()),
    createNarrativeProvider,
  );

  return roomService;
}

export * from "./identity";
export * from "./repository";
export * from "./service";
export * from "./state";
