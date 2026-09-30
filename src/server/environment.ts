import "server-only";

import { z } from "zod";

const supabaseServerEnvironmentSchema = z.object({
  SUPABASE_URL: z.url("deve ser uma URL valida"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string("e obrigatoria")
    .trim()
    .min(1, "e obrigatoria"),
});

const geminiServerEnvironmentSchema = z.object({
  GEMINI_API_KEY: z.string("e obrigatoria").trim().min(1, "e obrigatoria"),
  GEMINI_MODEL: z.string("e obrigatoria").trim().min(1, "e obrigatoria"),
});

const serverEnvironmentSchema = supabaseServerEnvironmentSchema.extend(
  geminiServerEnvironmentSchema.shape,
);

type ServerEnvironmentSource = Partial<
  Record<keyof z.input<typeof serverEnvironmentSchema>, string>
>;

export type ServerEnvironment = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  geminiApiKey: string;
  geminiModel: string;
};

export type SupabaseServerEnvironment = Pick<
  ServerEnvironment,
  "supabaseUrl" | "supabaseServiceRoleKey"
>;

export function parseServerEnvironment(
  source: ServerEnvironmentSource,
): ServerEnvironment {
  const result = serverEnvironmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${String(issue.path[0])}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Configuracao de ambiente server-side invalida: ${details}`,
    );
  }

  return {
    supabaseUrl: result.data.SUPABASE_URL,
    supabaseServiceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: result.data.GEMINI_API_KEY,
    geminiModel: result.data.GEMINI_MODEL,
  };
}

export function getServerEnvironment(): ServerEnvironment {
  return parseServerEnvironment({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });
}

export function parseSupabaseServerEnvironment(
  source: Pick<
    ServerEnvironmentSource,
    "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"
  >,
): SupabaseServerEnvironment {
  const result = supabaseServerEnvironmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${String(issue.path[0])}: ${issue.message}`)
      .join("; ");

    throw new Error(`Configuracao do Supabase invalida: ${details}`);
  }

  return {
    supabaseUrl: result.data.SUPABASE_URL,
    supabaseServiceRoleKey: result.data.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function getSupabaseServerEnvironment(): SupabaseServerEnvironment {
  return parseSupabaseServerEnvironment({
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
