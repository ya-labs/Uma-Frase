import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (process.env.CI) {
  // CI uses its isolated local Supabase, never a hosted project or real key.
  const status = JSON.parse(
    execFileSync("node_modules/.bin/supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (!status.API_URL || !status.SERVICE_ROLE_KEY || !status.ANON_KEY)
    throw new Error(
      "O Supabase local não confirmou as variáveis necessárias para o teste.",
    );
  Object.assign(process.env, {
    SUPABASE_URL: status.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  });
}
const baseURL = "http://127.0.0.1:3100";
process.env.NEXT_PUBLIC_APP_URL = baseURL;

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 12000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: baseURL,
    timeout: 60000,
    reuseExistingServer: false,
    env: {
      ...(process.env as Record<string, string>),
      UMA_FRASE_AI_PROVIDER: "demo",
    },
  },
});
