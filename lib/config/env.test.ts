import { expect, test } from "vitest";

test("parseEnv throws on missing required key", async () => {
  const { parseEnv } = await import("./env");
  expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow(/SUPABASE_URL/);
});

test("parseEnv returns typed config when valid", async () => {
  const { parseEnv } = await import("./env");
  const cfg = parseEnv({
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
    ANTHROPIC_API_KEY: "k", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p",
    TAVILY_API_KEY: "t", RESEND_API_KEY: "r", POSTHOG_KEY: "ph", POSTHOG_HOST: "https://app.posthog.com",
    SCAN_BUDGET_CENTS: "150",
  } as unknown as NodeJS.ProcessEnv);
  expect(cfg.scanBudgetCents).toBe(150);
  expect(cfg.anthropicApiKey).toBe("k");
});
