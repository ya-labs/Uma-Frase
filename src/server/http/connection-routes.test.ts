import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { handleConnectionCommand } from "./connection-routes";

it("pausa e retomada indicam presença sem aceitar fase escolhida pelo cliente", async () => {
  const service = { setPresence: vi.fn().mockResolvedValue({}) };
  for (const connected of [false, true]) {
    const response = await handleConnectionCommand(
      new Request("http://localhost/connection", {
        method: "POST",
        headers: {
          Authorization: "Bearer opaque-token-with-at-least-32-chars",
        },
        body: JSON.stringify({ status: "finished" }),
      }),
      { params: Promise.resolve({ code: "ABCD2345" }) },
      connected,
      service,
    );
    expect(response.status).toBe(200);
    expect(service.setPresence).toHaveBeenLastCalledWith({
      roomCode: "ABCD2345",
      playerToken: "opaque-token-with-at-least-32-chars",
      isConnected: connected,
    });
  }
});
it("recusa pausa sem identidade válida", async () => {
  const service = { setPresence: vi.fn() };
  expect(
    (
      await handleConnectionCommand(
        new Request("http://localhost/connection", { method: "POST" }),
        { params: Promise.resolve({ code: "ABCD2345" }) },
        false,
        service,
      )
    ).status,
  ).toBe(400);
  expect(service.setPresence).not.toHaveBeenCalled();
});
