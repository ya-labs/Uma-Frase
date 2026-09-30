"use client";

const TOKEN_KEY_PREFIX = "uma-frase:room-token:";

function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
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
  sessionStorage.setItem(
    `${TOKEN_KEY_PREFIX}${normalizeRoomCode(roomCode)}`,
    token,
  );
}

export function readRoomToken(roomCode: string): string | null {
  return sessionStorage.getItem(
    `${TOKEN_KEY_PREFIX}${normalizeRoomCode(roomCode)}`,
  );
}

export function removeRoomToken(roomCode: string): void {
  sessionStorage.removeItem(
    `${TOKEN_KEY_PREFIX}${normalizeRoomCode(roomCode)}`,
  );
}
