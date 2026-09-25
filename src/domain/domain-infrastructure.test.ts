import { describe, expect, it } from "vitest";

describe("infraestrutura de testes do dominio", () => {
  it("executa uma regra pura escrita em TypeScript", () => {
    const countItems = (items: readonly string[]) => items.length;

    expect(countItems(["uma", "frase"])).toBe(2);
  });
});
