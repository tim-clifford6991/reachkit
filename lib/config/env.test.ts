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
    VOYAGE_API_KEY: "vy", INNGEST_SIGNING_KEY: "signkey_test",
    STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_SOLO: "price_test",
    STRIPE_PRICE_GROWTH: "price_growth_test",
  } as unknown as NodeJS.ProcessEnv);
  expect(cfg.scanBudgetCents).toBe(150);
  expect(cfg.anthropicApiKey).toBe("k");
  expect(cfg.inngestSigningKey).toBe("signkey_test");
  expect(cfg.billingGraceDays).toBe(3);
  expect(cfg.useFixtures).toBe(false);
  // Observability (P4): kill switch defaults ON; webhook default blank.
  expect(cfg.scanningEnabled).toBe(true);
  expect(cfg.costAlertWebhookUrl).toBe("");
});

test("SCANNING_ENABLED kill switch: only the literal 'false' disables scanning", async () => {
  const { parseEnv } = await import("./env");
  const base = {
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
    REACHKIT_USE_FIXTURES: "true",
  } as unknown as NodeJS.ProcessEnv;
  expect(parseEnv(base).scanningEnabled).toBe(true); // unset → ON
  expect(parseEnv({ ...base, SCANNING_ENABLED: "true" }).scanningEnabled).toBe(true);
  expect(parseEnv({ ...base, SCANNING_ENABLED: "false" }).scanningEnabled).toBe(false);
  expect(parseEnv({ ...base, COST_ALERT_WEBHOOK_URL: "https://hooks.example/x" }).costAlertWebhookUrl).toBe(
    "https://hooks.example/x",
  );
});

test("parseEnv throws when STRIPE_PRICE_GROWTH is missing and fixtures mode is off", async () => {
  // Growth is sold on /pricing — a deploy missing its price id must fail at
  // boot, not silently at the Growth checkout button (launch review 2026-07-15).
  const { parseEnv } = await import("./env");
  expect(() =>
    parseEnv({
      SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
      ANTHROPIC_API_KEY: "k", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p",
      TAVILY_API_KEY: "t", RESEND_API_KEY: "r", PRODUCT_HUNT_TOKEN: "ph", YOUTUBE_API_KEY: "yt",
      VOYAGE_API_KEY: "vy", INNGEST_SIGNING_KEY: "signkey_test",
      STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_SOLO: "price_test",
      // STRIPE_PRICE_GROWTH intentionally absent
    } as unknown as NodeJS.ProcessEnv),
  ).toThrow(/STRIPE_PRICE_GROWTH/);
});

test("parseEnv throws when INNGEST_SIGNING_KEY is missing and fixtures mode is off", async () => {
  const { parseEnv } = await import("./env");
  expect(() =>
    parseEnv({
      SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
      ANTHROPIC_API_KEY: "k", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p",
      TAVILY_API_KEY: "t", RESEND_API_KEY: "r", PRODUCT_HUNT_TOKEN: "ph", YOUTUBE_API_KEY: "yt",
      VOYAGE_API_KEY: "vy",
      // INNGEST_SIGNING_KEY intentionally absent
    } as unknown as NodeJS.ProcessEnv),
  ).toThrow(/INNGEST_SIGNING_KEY/);
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

test("parseEnv HARD-FAILS when REACHKIT_USE_FIXTURES=true in production (fixtures must never ship)", async () => {
  const { parseEnv } = await import("./env");
  // fixtures mode + NODE_ENV=production is the catastrophic misconfiguration:
  // fixturesEnabled() has no NODE_ENV guard of its own, so one mistyped Vercel
  // env var would give free tier upgrades to any user, rate limiting off, and
  // magic links printed to logs — in production. The parse must refuse it.
  expect(() =>
    parseEnv({
      SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
      REACHKIT_USE_FIXTURES: "true",
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv),
  ).toThrow(/REACHKIT_USE_FIXTURES/);
});

test("parseEnv still ALLOWS fixtures in development and test (the intended use)", async () => {
  const { parseEnv } = await import("./env");
  const base = {
    SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
    REACHKIT_USE_FIXTURES: "true",
  } as unknown as NodeJS.ProcessEnv;
  expect(parseEnv({ ...base, NODE_ENV: "development" }).useFixtures).toBe(true);
  expect(parseEnv({ ...base, NODE_ENV: "test" }).useFixtures).toBe(true);
  expect(parseEnv(base).useFixtures).toBe(true); // NODE_ENV unset → allowed
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
