import "server-only";
import {
  pauseRoomCommandSchema,
  resumeRoomCommandSchema,
} from "@/domain/contracts";
import { getRoomService } from "../rooms";
import {
  bearerToken,
  operationError,
  validationError,
  type RoomServicePort,
} from "./room-routes";

export async function handleConnectionCommand(
  request: Request,
  context: { params: Promise<{ code: string }> },
  connected: boolean,
  service: Pick<RoomServicePort, "setPresence"> = getRoomService(),
): Promise<Response> {
  const { code } = await context.params;
  const command = (
    connected ? resumeRoomCommandSchema : pauseRoomCommandSchema
  ).safeParse({ roomCode: code, playerToken: bearerToken(request) });
  if (!command.success) return validationError(command.error);
  try {
    return Response.json({
      ok: true,
      data: {
        state: await service.setPresence({
          ...command.data,
          isConnected: connected,
        }),
      },
    });
  } catch (error) {
    return operationError(error);
  }
}
