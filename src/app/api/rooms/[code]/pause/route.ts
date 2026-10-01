import { handleConnectionCommand } from "@/server/http/connection-routes";
export function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  return handleConnectionCommand(request, context, false);
}
