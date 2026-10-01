import "server-only";
import { randomInt } from "node:crypto";

// Tunable MVP weights: 1 is special, 2–3 and 11–15 rare, 4–10 common.
export const WORD_LIMIT_WEIGHTS = [
  1, 2, 2, 10, 10, 10, 10, 10, 10, 10, 2, 2, 2, 2, 2,
] as const;

export function drawWordLimit(
  draw: (max: number) => number = randomInt,
): number {
  const total = WORD_LIMIT_WEIGHTS.reduce<number>(
    (sum, weight) => sum + weight,
    0,
  );
  let choice = draw(total);
  if (!Number.isInteger(choice) || choice < 0 || choice >= total)
    throw new Error("Invalid random draw.");
  for (const [index, weight] of WORD_LIMIT_WEIGHTS.entries()) {
    if (choice < weight) return index + 1;
    choice -= weight;
  }
  throw new Error("Invalid word limit distribution.");
}
