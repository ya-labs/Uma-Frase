import { handleStartRoom } from "@/server/http/room-routes";

type RouteContext = { params: Promise<{ code: string }> };
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  return handleStartRoom(request, context);
}
