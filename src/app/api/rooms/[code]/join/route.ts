import { handleJoinRoom } from "@/server/http/room-routes";

type RouteContext = { params: Promise<{ code: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return handleJoinRoom(request, context);
}
