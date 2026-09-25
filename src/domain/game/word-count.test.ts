import { describe, expect, it } from "vitest";

import { checkWordLimit, countWords } from "./word-count";

describe("countWords", () => {
  it("conta palavras separadas por qualquer espaco", () => {
    expect(countWords("  uma   frase\npor\tvez  ")).toBe(4);
  });

  it("nao transforma pontuacao anexada em outra palavra", () => {
    expect(countWords("Ola, mundo!")).toBe(2);
  });

  it("considera texto vazio como ausencia de resposta", () => {
    expect(countWords("   \n\t ")).toBe(0);
  });
});

describe("checkWordLimit", () => {
  it("informa contagem e excesso de palavras", () => {
    expect(checkWordLimit("uma frase curta", 2)).toEqual({
      count: 3,
      limit: 2,
      isWithinLimit: false,
    });
  });

  it("recusa limites invalidos", () => {
    expect(() => checkWordLimit("texto", 0)).toThrow(RangeError);
  });
});
