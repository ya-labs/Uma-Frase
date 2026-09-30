import { describe, expect, it } from "vitest";

import { parsePublicEnvironment } from "./environment";

describe("ambiente publico", () => {
  it("expoe somente a configuracao que pode chegar ao navegador", () => {
    const environment = parsePublicEnvironment({
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });

    expect(environment).toEqual({
      appUrl: "http://localhost:3000",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-key",
    });
    expect(environment).not.toHaveProperty("supabaseServiceRoleKey");
    expect(environment).not.toHaveProperty("geminiApiKey");
  });

  it("informa todas as variaveis ausentes sem revelar valores", () => {
    expect(() => parsePublicEnvironment({})).toThrowError(
      /NEXT_PUBLIC_APP_URL.*NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
