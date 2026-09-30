import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnvironment, type ServerEnvironment } from "./environment";

export function createSupabaseAdminClient(
  environment: ServerEnvironment = getServerEnvironment(),
): SupabaseClient {
  return createClient(
    environment.supabaseUrl,
    environment.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
