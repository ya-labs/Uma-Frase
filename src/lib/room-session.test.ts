import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPlayerToken,
  createRoomSessionStore,
  readRoomToken,
  removeRoomToken,
  saveRoomToken,
} from "./room-session";

describe("identidade da sala por aba", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persiste e recupera o token opaco em um storage controlado", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    };
    const sessions = createRoomSessionStore(storage);

    sessions.savePlayerToken(" abcd2345 ", "opaque-token");

    expect(sessions.getPlayerToken("ABCD2345")).toBe("opaque-token");
    expect(storage.setItem).toHaveBeenCalledWith(
      "uma-frase:room:ABCD2345:player-token",
      "opaque-token",
    );

    sessions.removePlayerToken("abcd2345");
    expect(sessions.getPlayerToken("ABCD2345")).toBeNull();
  });

  it("compartilha a mesma identidade entre as duas APIs por sala", () => {
    const sessions = createRoomSessionStore();

    saveRoomToken(" room1234 ", "token-one");
    sessions.savePlayerToken("OTHER123", "token-two");

    expect(readRoomToken("ROOM1234")).toBe("token-one");
    expect(readRoomToken("other123")).toBe("token-two");

    removeRoomToken("room1234");
    expect(sessions.getPlayerToken("ROOM1234")).toBeNull();
    expect(sessions.getPlayerToken("OTHER123")).toBe("token-two");
  });

  it("gera um token opaco sem depender de dados pessoais", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).fill(7);
      return array;
    });

    expect(createPlayerToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
