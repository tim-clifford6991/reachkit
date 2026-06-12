import { expect, test } from "vitest";

// NOTE: each test uses vi.resetModules() implicitly via fresh dynamic imports
// so module-level caching in env.ts does not bleed between tests.

test("parseEnv throws on missing required key (SUPABASE_URL)", async () => {
  const { parseEnv } = await import("./env");
  expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow(/SUPABASE_URL/);
});

test("parseEnv returns typed config when all keys supplied (fixtures off)", async () => {
  const { parseEnv } = await import("./env");
  const cfg = parseEnv({
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
    ANTHROPIC_API_KEY: "k", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p",
    TAVILY_API_KEY: "t", RESEND_API_KEY: "r", POSTHOG_KEY: "ph", POSTHOG_HOST: "https://app.posthog.com",
    SCAN_BUDGET_CENTS: "150", PRODUCT_HUNT_TOKEN: "ph", YOUTUBE_API_KEY: "yt",
    VOYAGE_API_KEY: "vy",
  } as unknown as NodeJS.ProcessEnv);
  expect(cfg.scanBudgetCents).toBe(150);
  expect(cfg.anthropicApiKey).toBe("k");
  expect(cfg.useFixtures).toBe(false);
});

test("parseEnv succeeds with blank paid keys when REACHKIT_USE_FIXTURES=true", async () => {
  const { parseEnv } = await import("./env");
  // Paid keys absent / blank — must NOT throw in fixtures mode
  const cfg = parseEnv({
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
    REACHKIT_USE_FIXTURES: "true",
  } as unknown as NodeJS.ProcessEnv);
  expect(cfg.useFixtures).toBe(true);
  expect(cfg.anthropicApiKey).toBe("");
  expect(cfg.dataforseoLogin).toBe("");
  expect(cfg.tavilyApiKey).toBe("");
  expect(cfg.resendApiKey).toBe("");
  expect(cfg.productHuntToken).toBe("");
});

test("parseEnv throws when paid key is blank and fixtures mode is off", async () => {
  const { parseEnv } = await import("./env");
  // All paid keys present EXCEPT ANTHROPIC_API_KEY — must throw naming the missing key
  expect(() =>
    parseEnv({
      SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
      DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p",
      TAVILY_API_KEY: "t", RESEND_API_KEY: "r", PRODUCT_HUNT_TOKEN: "ph",
      // ANTHROPIC_API_KEY intentionally absent
    } as unknown as NodeJS.ProcessEnv),
  ).toThrow(/ANTHROPIC_API_KEY/);
});
