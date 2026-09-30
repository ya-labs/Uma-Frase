import { handleCreateRoom } from "@/server/http/room-routes";

export async function POST(request: Request): Promise<Response> {
  return handleCreateRoom(request);
}
