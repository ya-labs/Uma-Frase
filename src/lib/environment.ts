import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url("deve ser uma URL valida"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("deve ser uma URL valida"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string("e obrigatoria")
    .trim()
    .min(1, "e obrigatoria"),
});

type PublicEnvironmentSource = Partial<
  Record<keyof z.input<typeof publicEnvironmentSchema>, string>
>;

export type PublicEnvironment = {
  appUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export function parsePublicEnvironment(
  source: PublicEnvironmentSource,
): PublicEnvironment {
  const result = publicEnvironmentSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${String(issue.path[0])}: ${issue.message}`)
      .join("; ");

    throw new Error(`Configuracao de ambiente publica invalida: ${details}`);
  }

  return {
    appUrl: result.data.NEXT_PUBLIC_APP_URL,
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function getPublicEnvironment(): PublicEnvironment {
  return parsePublicEnvironment({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
