import { z } from "zod";

export const roomStateChangedEventSchema = z
  .object({
    type: z.literal("room_state_changed"),
    roomCode: z.string().trim().min(1),
  })
  .strict();

export const roomRealtimeEventSchema = z.discriminatedUnion("type", [
  roomStateChangedEventSchema,
]);

export type RoomStateChangedEvent = z.infer<typeof roomStateChangedEventSchema>;
export type RoomRealtimeEvent = z.infer<typeof roomRealtimeEventSchema>;
