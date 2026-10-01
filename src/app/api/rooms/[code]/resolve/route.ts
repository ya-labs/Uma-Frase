import { handleRoundCommand } from "@/server/http/round-routes";

export function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  return handleRoundCommand(request, context, "resolve");
}
