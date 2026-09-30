import "server-only";

import { createSupabaseAdminClient } from "../supabase";
import { SupabaseRoomRepository } from "./repository";
import { RoomService } from "./service";

let roomService: RoomService | undefined;

export function getRoomService(): RoomService {
  roomService ??= new RoomService(
    new SupabaseRoomRepository(createSupabaseAdminClient()),
  );

  return roomService;
}

export * from "./identity";
export * from "./repository";
export * from "./service";
export * from "./state";
