import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ client: "supabase" })),
  googleGenAI: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class GoogleGenAIMock {
    constructor(options: unknown) {
      mocks.googleGenAI(options);
    }
  },
}));

import { createGeminiServerClient } from "./ai/gemini";
import { parseServerEnvironment } from "./environment";
import { createSupabaseAdminClient } from "./supabase";

const validEnvironment = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role-secret",
  geminiApiKey: "gemini-secret",
  geminiModel: "gemini-model",
};

describe("ambiente server-side", () => {
  it("falha com os nomes das variaveis ausentes e sem revelar segredos", () => {
    expect(() =>
      parseServerEnvironment({
        SUPABASE_URL: "invalida",
        SUPABASE_SERVICE_ROLE_KEY: "valor-que-nao-deve-aparecer",
      }),
    ).toThrowError(/SUPABASE_URL.*GEMINI_API_KEY.*GEMINI_MODEL/);

    let caughtError: unknown;

    try {
      parseServerEnvironment({ GEMINI_API_KEY: "segredo-do-teste" });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(String(caughtError)).not.toContain("segredo-do-teste");
    expect(String(caughtError)).toContain("SUPABASE_URL");
  });
});

describe("clientes server-side", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria o Supabase administrativo sem persistir sessao", () => {
    createSupabaseAdminClient(validEnvironment);

    expect(mocks.createClient).toHaveBeenCalledWith(
      validEnvironment.supabaseUrl,
      validEnvironment.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  });

  it("cria o Gemini com chave privada e preserva o modelo configurado", () => {
    const gemini = createGeminiServerClient(validEnvironment);

    expect(mocks.googleGenAI).toHaveBeenCalledWith({
      apiKey: validEnvironment.geminiApiKey,
    });
    expect(gemini.model).toBe(validEnvironment.geminiModel);
  });
});
