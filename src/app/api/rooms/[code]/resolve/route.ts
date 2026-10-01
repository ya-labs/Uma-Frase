import { handleRoundCommand } from "@/server/http/round-routes";
export const maxDuration = 60;

export function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<Response> {
  return handleRoundCommand(request, context, "resolve");
}
