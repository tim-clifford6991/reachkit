import { expect, test } from "vitest";

// NOTE: each test uses vi.resetModules() implicitly via fresh dynamic imports
// so module-level caching in env.ts does not bleed between tests.

// A full, valid production env (all paid + Stripe keys present).
const FULL_ENV = {
  SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
  ANTHROPIC_API_KEY: "k", DATAFORSEO_LOGIN: "l", DATAFORSEO_PASSWORD: "p",
  TAVILY_API_KEY: "t", RESEND_API_KEY: "r", POSTHOG_KEY: "ph", POSTHOG_HOST: "https://app.posthog.com",
  SCAN_BUDGET_CENTS: "150", PRODUCT_HUNT_TOKEN: "ph", YOUTUBE_API_KEY: "yt",
  VOYAGE_API_KEY: "vy", INNGEST_SIGNING_KEY: "signkey_test",
  STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_test", STRIPE_PRICE_SOLO: "price_test",
  STRIPE_PRICE_GROWTH: "price_growth_test",
} as unknown as NodeJS.ProcessEnv;

const BARE_ENV = {
  SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "a", SUPABASE_SERVICE_ROLE_KEY: "s",
} as unknown as NodeJS.ProcessEnv;

/** FULL_ENV minus one key, as a plain object (for the "missing key" cases). */
function omit(key: string): NodeJS.ProcessEnv {
  const e = { ...(FULL_ENV as Record<string, string | undefined>) };
  delete e[key];
  return e as unknown as NodeJS.ProcessEnv;
}

test("parseEnv throws on missing required key (SUPABASE_URL)", async () => {
  const { parseEnv } = await import("./env");
  expect(() => parseEnv({} as NodeJS.ProcessEnv)).toThrow(/SUPABASE_URL/);
});

test("parseEnv returns typed config when all keys supplied", async () => {
  const { parseEnv } = await import("./env");
  const cfg = parseEnv(FULL_ENV);
  expect(cfg.scanBudgetCents).toBe(150);
  expect(cfg.anthropicApiKey).toBe("k");
  expect(cfg.inngestSigningKey).toBe("signkey_test");
  expect(cfg.billingGraceDays).toBe(3);
  // Observability (P4): kill switch defaults ON; webhook default blank.
  expect(cfg.scanningEnabled).toBe(true);
  expect(cfg.costAlertWebhookUrl).toBe("");
});

test("SCANNING_ENABLED kill switch: only the literal 'false' disables scanning", async () => {
  const { parseEnv } = await import("./env");
  expect(parseEnv(BARE_ENV).scanningEnabled).toBe(true); // unset → ON
  expect(parseEnv({ ...BARE_ENV, SCANNING_ENABLED: "true" }).scanningEnabled).toBe(true);
  expect(parseEnv({ ...BARE_ENV, SCANNING_ENABLED: "false" }).scanningEnabled).toBe(false);
  expect(parseEnv({ ...BARE_ENV, COST_ALERT_WEBHOOK_URL: "https://hooks.example/x" }).costAlertWebhookUrl).toBe(
    "https://hooks.example/x",
  );
});

// ---------------------------------------------------------------------------
// Paid/Stripe keys are REQUIRED IN PRODUCTION (NODE_ENV=production) so a
// misconfigured prod deploy fails at boot, not silently at checkout/scan time.
// This was gated on the deleted REACHKIT_USE_FIXTURES flag; Phase 8 re-keyed it
// to NODE_ENV. Fixtures are now an injected TEST SEAM, not an env flag — there is
// nothing to "hard-fail in production" any more (nothing to mistype), which is why
// the old "REACHKIT_USE_FIXTURES=true in production must throw" test is gone.
// ---------------------------------------------------------------------------

test("parseEnv throws in production when STRIPE_PRICE_GROWTH is missing", async () => {
  // Growth is sold on /pricing — a deploy missing its price id must fail at boot.
  const { parseEnv } = await import("./env");
  expect(() => parseEnv({ ...omit("STRIPE_PRICE_GROWTH"), NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
    /STRIPE_PRICE_GROWTH/,
  );
});

test("parseEnv throws in production when INNGEST_SIGNING_KEY is missing", async () => {
  const { parseEnv } = await import("./env");
  expect(() => parseEnv({ ...omit("INNGEST_SIGNING_KEY"), NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
    /INNGEST_SIGNING_KEY/,
  );
});

test("parseEnv throws in production when a paid key (ANTHROPIC_API_KEY) is blank", async () => {
  const { parseEnv } = await import("./env");
  expect(() => parseEnv({ ...omit("ANTHROPIC_API_KEY"), NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(
    /ANTHROPIC_API_KEY/,
  );
});

test("parseEnv RELAXES the paid-key requirement outside production (dev/test/unset)", async () => {
  // Tests inject canned data via the fixture SEAM (installFixtures); local dev may
  // run keyless — so a bare env (no paid/Stripe keys) parses when NODE_ENV is not
  // "production". Successor to the old fixtures-mode relaxation.
  const { parseEnv } = await import("./env");
  for (const nodeEnv of ["development", "test", undefined]) {
    const cfg = parseEnv(nodeEnv ? ({ ...BARE_ENV, NODE_ENV: nodeEnv } as NodeJS.ProcessEnv) : BARE_ENV);
    expect(cfg.anthropicApiKey).toBe("");
    expect(cfg.stripeSecretKey).toBe("");
  }
});
