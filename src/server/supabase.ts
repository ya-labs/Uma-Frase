import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getSupabaseServerEnvironment,
  type SupabaseServerEnvironment,
} from "./environment";

export function createSupabaseAdminClient(
  environment: SupabaseServerEnvironment = getSupabaseServerEnvironment(),
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
