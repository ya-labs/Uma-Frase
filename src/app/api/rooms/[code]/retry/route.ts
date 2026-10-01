import { retryRoomCommandSchema } from "@/domain/contracts";
import { getRoomService } from "@/server/rooms";
import {
  bearerToken,
  operationError,
  validationError,
} from "@/server/http/room-routes";

export const maxDuration = 60;
export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await context.params;
  const command = retryRoomCommandSchema.safeParse({
    roomCode: code,
    playerToken: bearerToken(request),
  });
  if (!command.success) return validationError(command.error);
  try {
    return Response.json({
      ok: true,
      data: { state: await getRoomService().retry(command.data) },
    });
  } catch (error) {
    return operationError(error);
  }
}
