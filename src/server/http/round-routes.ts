import "server-only";

import {
  submitAnswerCommandSchema,
  resolveRoomCommandSchema,
} from "@/domain/contracts";
import { getRoomService } from "../rooms";
import type { RoundService } from "../rounds/service";
import {
  readJson,
  bearerToken,
  validationError,
  operationError,
} from "./room-routes";

export async function handleRoundCommand(
  request: Request,
  context: { params: Promise<{ code: string }> },
  action: "submit" | "resolve",
  service: Pick<RoundService, "submit" | "resolve"> = getRoomService(),
): Promise<Response> {
  const { code } = await context.params;
  const body = await readJson(request);
  const input = {
    ...(typeof body === "object" && body !== null ? body : {}),
    roomCode: code,
    playerToken: bearerToken(request),
  };
  try {
    if (action === "submit") {
      const command = submitAnswerCommandSchema.safeParse(input);
      if (!command.success) return validationError(command.error);
      return Response.json({
        ok: true,
        data: { state: await service.submit(command.data) },
      });
    }
    const command = resolveRoomCommandSchema.safeParse(input);
    if (!command.success) return validationError(command.error);
    return Response.json({
      ok: true,
      data: { state: await service.resolve(command.data) },
    });
  } catch (error) {
    return operationError(error);
  }
}
