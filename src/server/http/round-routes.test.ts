import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import { handleRoundCommand } from "./round-routes";

const context = { params: Promise.resolve({ code: "ABCD2345" }) };
const token = "opaque-token-with-at-least-32-chars";
describe("rotas privadas de resposta", () => {
  it("recusa ausência de identidade e dados extras", async () => {
    const service = { submit: vi.fn(), resolve: vi.fn() };
    for (const body of [
      { roundId: "r", text: "Olá" },
      { roundId: "r", text: "Olá", winnerPlayerId: "hacker" },
    ]) {
      const response = await handleRoundCommand(
        new Request("http://localhost/answer", {
          method: "POST",
          headers: { authorization: "Bearer " + token },
          body: JSON.stringify(body),
        }),
        context,
        "submit",
        service,
      );
      if ("winnerPlayerId" in body) expect(response.status).toBe(400);
    }
    const response = await handleRoundCommand(
      new Request("http://localhost/answer", {
        method: "POST",
        body: JSON.stringify({ roundId: "r", text: "Olá" }),
      }),
      context,
      "submit",
      service,
    );
    expect(response.status).toBe(400);
  });

  it("não revela erro interno", async () => {
    const service = {
      submit: vi.fn().mockRejectedValue(new Error("key=secret prompt=secret")),
      resolve: vi.fn(),
    };
    const response = await handleRoundCommand(
      new Request("http://localhost/answer", {
        method: "POST",
        headers: { authorization: "Bearer " + token },
        body: JSON.stringify({ roundId: "r", text: "Olá" }),
      }),
      context,
      "submit",
      service,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });
});
