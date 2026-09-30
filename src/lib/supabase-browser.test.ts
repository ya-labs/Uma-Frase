import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(() => ({ client: "browser" })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

import { createSupabaseBrowserClient } from "./supabase-browser";

describe("cliente Supabase do navegador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa apenas URL e chave publicaveis", () => {
    createSupabaseBrowserClient({
      appUrl: "http://localhost:3000",
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-key",
    });

    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-key",
    );
  });
});
