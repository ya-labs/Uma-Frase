import { describe, expect, it, vi } from "vitest";

import { createRoomSessionStore } from "./room-session";

describe("identidade da sala por aba", () => {
  it("persiste e recupera o token opaco em um storage controlado", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    };
    const sessions = createRoomSessionStore(storage);

    sessions.savePlayerToken("ABC123", "opaque-token");

    expect(sessions.getPlayerToken("ABC123")).toBe("opaque-token");
    expect(storage.setItem).toHaveBeenCalledWith(
      "uma-frase:room:ABC123:player-token",
      "opaque-token",
    );

    sessions.removePlayerToken("ABC123");
    expect(sessions.getPlayerToken("ABC123")).toBeNull();
  });

  it("isola a identidade pelo código da sala", () => {
    const storage = window.sessionStorage;
    storage.clear();
    const sessions = createRoomSessionStore(storage);

    sessions.savePlayerToken("ROOM01", "token-one");
    sessions.savePlayerToken("ROOM02", "token-two");

    expect(sessions.getPlayerToken("ROOM01")).toBe("token-one");
    expect(sessions.getPlayerToken("ROOM02")).toBe("token-two");
  });
});
