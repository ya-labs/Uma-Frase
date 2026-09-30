import "server-only";

import { createHash, randomBytes } from "node:crypto";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 8;

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase();
}

export function generateRoomCode(): string {
  const bytes = randomBytes(ROOM_CODE_LENGTH);

  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte & 31]).join("");
}

export function generatePlayerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashPlayerToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
