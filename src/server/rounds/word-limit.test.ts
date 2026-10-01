import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { drawWordLimit, WORD_LIMIT_WEIGHTS } from "./word-limit";

it("distribui exatamente os pesos e permite todos os limites de 1 a 15", () => {
  const counts = Array(15).fill(0) as number[];
  const total = WORD_LIMIT_WEIGHTS.reduce<number>(
    (sum, weight) => sum + weight,
    0,
  );
  for (let index = 0; index < total; index++)
    counts[drawWordLimit(() => index) - 1]++;
  expect(counts).toEqual(WORD_LIMIT_WEIGHTS);
  expect(() => drawWordLimit(() => total)).toThrow();
});
