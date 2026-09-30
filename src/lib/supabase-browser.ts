"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicEnvironment, type PublicEnvironment } from "./environment";

let browserClient: SupabaseClient | undefined;

export function createSupabaseBrowserClient(
  environment: PublicEnvironment = getPublicEnvironment(),
): SupabaseClient {
  return createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );
}

export function getSupabaseBrowserClient(): SupabaseClient {
  browserClient ??= createSupabaseBrowserClient();
  return browserClient;
}
