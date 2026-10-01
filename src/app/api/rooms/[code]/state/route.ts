import { handleGetRoomState } from "@/server/http/room-routes";

type RouteContext = { params: Promise<{ code: string }> };
export const maxDuration = 60;

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return handleGetRoomState(request, context);
}
