"use client";

export type RoomSessionStore = {
  getPlayerToken(roomCode: string): string | null;
  savePlayerToken(roomCode: string, playerToken: string): void;
  removePlayerToken(roomCode: string): void;
};

const storagePrefix = "uma-frase:room";

function storageKey(roomCode: string) {
  return `${storagePrefix}:${encodeURIComponent(roomCode.trim().toUpperCase())}:player-token`;
}

function browserSessionStorage() {
  if (typeof window === "undefined") {
    throw new Error(
      "A identidade da sala está disponível apenas no navegador.",
    );
  }

  return window.sessionStorage;
}

export function createRoomSessionStore(
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): RoomSessionStore {
  const getStorage = () => storage ?? browserSessionStorage();

  return {
    getPlayerToken(roomCode) {
      const token = getStorage().getItem(storageKey(roomCode));
      return token?.trim() ? token : null;
    },

    savePlayerToken(roomCode, playerToken) {
      if (!roomCode.trim() || !playerToken.trim()) {
        throw new Error("Sala e identidade são obrigatórias.");
      }

      getStorage().setItem(storageKey(roomCode), playerToken);
    },

    removePlayerToken(roomCode) {
      getStorage().removeItem(storageKey(roomCode));
    },
  };
}

export function createPlayerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    "",
  );

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function saveRoomToken(roomCode: string, token: string): void {
  createRoomSessionStore().savePlayerToken(roomCode, token);
}

export function readRoomToken(roomCode: string): string | null {
  return createRoomSessionStore().getPlayerToken(roomCode);
}

export function removeRoomToken(roomCode: string): void {
  createRoomSessionStore().removePlayerToken(roomCode);
}
