export type WordCountResult = {
  count: number;
  limit: number;
  isWithinLimit: boolean;
};

export function countWords(text: string): number {
  const normalizedText = text.trim();

  if (normalizedText.length === 0) return 0;

  return normalizedText.split(/\s+/u).length;
}

export function checkWordLimit(text: string, limit: number): WordCountResult {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("O limite de palavras deve ser um inteiro positivo.");
  }

  const count = countWords(text);

  return {
    count,
    limit,
    isWithinLimit: count <= limit,
  };
}
