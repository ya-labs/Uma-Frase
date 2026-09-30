import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPlayerToken,
  readRoomToken,
  removeRoomToken,
  saveRoomToken,
} from "./room-session";

describe("identidade local da sala", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("mantém tokens separados por sala e por sessionStorage da aba", () => {
    saveRoomToken(" room1234 ", "token-1");

    expect(readRoomToken("ROOM1234")).toBe("token-1");
    expect(readRoomToken("OTHER123")).toBeNull();

    removeRoomToken("room1234");
    expect(readRoomToken("ROOM1234")).toBeNull();
  });

  it("gera um token opaco sem depender de dados pessoais", () => {
    vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
      (array as Uint8Array).fill(7);
      return array;
    });

    expect(createPlayerToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
