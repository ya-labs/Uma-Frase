import { describe, expect, it, vi } from "vitest";

import { roomStateFixture } from "@/domain/contracts/fixtures";

import { createRoomClient, RoomClientError } from "./room-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("cliente HTTP das salas", () => {
  it("cria uma sala e valida a resposta tipada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: true,
        data: {
          playerToken: "opaque-token-with-at-least-32-chars",
          state: roomStateFixture,
        },
      }),
    );
    const client = createRoomClient({ fetch: fetchMock });

    const session = await client.createRoom({ playerName: "Ana" });

    expect(session.state).toEqual(roomStateFixture);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rooms",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ playerName: "Ana" }),
      }),
    );
  });

  it("mantém o token apenas no cabeçalho das chamadas autenticadas", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ ok: true, data: { state: roomStateFixture } }),
      );
    const client = createRoomClient({ fetch: fetchMock });

    await client.getRoomState("ABC123", "opaque-token");

    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/rooms/ABC123/state");
    expect(path).not.toContain("opaque-token");
    expect(init.body).toBeUndefined();
    expect(init.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer opaque-token" }),
    );
  });

  it("envia somente rodada e texto no corpo autenticado da resposta", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ ok: true, data: { state: roomStateFixture } }),
      );
    const client = createRoomClient({ fetch: fetchMock });

    await client.submitAnswer(
      "ABC123",
      "opaque-token",
      "round-1",
      "  Eu atravesso a porta.  ",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rooms/ABC123/answer",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer opaque-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          roundId: "round-1",
          text: "  Eu atravesso a porta.  ",
        }),
      }),
    );
  });

  it("converte erros do contrato em mensagens públicas uniformes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          ok: false,
          error: {
            code: "authorization_error",
            message: "Token opaque-token inválido.",
          },
        },
        401,
      ),
    );
    const client = createRoomClient({ fetch: fetchMock });

    const error = await client
      .getRoomState("ABC123", "opaque-token")
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(RoomClientError);
    expect((error as Error).message).toBe(
      "Sua identificação nesta sala não é válida. Entre novamente.",
    );
    expect((error as Error).message).not.toContain("opaque-token");
  });

  it("trata respostas fora do contrato sem revelar o conteúdo recebido", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ token: "leaked-token" }, 500));
    const client = createRoomClient({ fetch: fetchMock });

    const error = await client
      .createRoom({ playerName: "Ana" })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(RoomClientError);
    expect((error as Error).message).not.toContain("leaked-token");
  });
});
