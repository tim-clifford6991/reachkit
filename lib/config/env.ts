import { z } from "zod";

/**
 * Paid/keyed vars: optional with blank default so fixtures mode needs no keys.
 * The superRefine below enforces non-empty when REACHKIT_USE_FIXTURES is false.
 *
 * Note: superRefine runs AFTER field transforms, so val.REACHKIT_USE_FIXTURES is
 * the transformed boolean (true/false), not the raw string "true"/"false".
 */
const PAID_KEYS = [
  "ANTHROPIC_API_KEY",
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "TAVILY_API_KEY",
  "RESEND_API_KEY",
  "PRODUCT_HUNT_TOKEN",
  "YOUTUBE_API_KEY",
  "VOYAGE_API_KEY",
  // Signing key for the Inngest serve endpoint — without it the
  // function-invocation endpoint (/api/inngest) is unauthenticated. Required in
  // prod so a misconfigured deploy fails at boot, not silently open.
  "INNGEST_SIGNING_KEY",
] as const;

// The money-path keys: required in prod so a deploy missing them fails at boot
// instead of silently at checkout/webhook time. Separate from PAID_KEYS so the
// intent is clear (these gate real charges, not vendor calls).
const STRIPE_REQUIRED_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_SOLO",
] as const;

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Paid/keyed vars — optional in fixtures mode, required otherwise
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  DATAFORSEO_LOGIN: z.string().optional().default(""),
  DATAFORSEO_PASSWORD: z.string().optional().default(""),
  TAVILY_API_KEY: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  PRODUCT_HUNT_TOKEN: z.string().optional().default(""),
  YOUTUBE_API_KEY: z.string().optional().default(""),
  VOYAGE_API_KEY: z.string().optional().default(""),
  // Stripe — fully optional (not in PAID_KEYS so keyless dev works)
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_PRICE_SOLO: z.string().optional().default(""),
  STRIPE_PRICE_GROWTH: z.string().optional().default(""),
  // Annual recurring prices (2-months-free yearly billing). Optional: when blank,
  // the annual toggle still renders but checkout falls back to the monthly price.
  STRIPE_PRICE_SOLO_ANNUAL: z.string().optional().default(""),
  STRIPE_PRICE_GROWTH_ANNUAL: z.string().optional().default(""),
  // Analytics — fully optional
  POSTHOG_KEY: z.string().optional().default(""),
  POSTHOG_HOST: z.string().optional().default(""),
  INNGEST_SIGNING_KEY: z.string().optional().default(""),
  // Observability kill switch (P4): set to "false" to pause all new scans at the
  // entrypoints (a friendly "scans paused" state) without a redeploy — the
  // mitigation when Anthropic/DataForSEO/Tavily is degraded. Any other value
  // (or unset) keeps scanning ON.
  SCANNING_ENABLED: z.string().optional().transform((v) => v !== "false"),
  // Optional delivery channel for cost alerts (P4): a webhook (e.g. Slack
  // incoming-webhook) that receives a JSON POST when a per-scan / per-user cost
  // cap is breached, in addition to console + the persisted scan event. Blank →
  // no webhook (console + PostHog only).
  COST_ALERT_WEBHOOK_URL: z.string().optional().default(""),
  // Days after a subscription's period end that a `past_due` (failed renewal)
  // still keeps access — the payment-failed grace window (no trial exists).
  BILLING_GRACE_DAYS: z.coerce.number().int().nonnegative().default(3),
  APP_URL: z.string().optional().default("http://localhost:3000"),
  SCAN_BUDGET_CENTS: z.coerce.number().int().positive().default(250),
  // Weekly delta-refresh ceiling — cheaper than a first scan; the refresh re-runs
  // market analysis on the Standard queue.
  WEEKLY_REFRESH_BUDGET_CENTS: z.coerce.number().int().positive().default(120),
  DATAFORSEO_LOCATION_CODE: z.coerce.number().int().default(2840), // US
  DATAFORSEO_LANGUAGE_CODE: z.string().default("en"),
  // External-spend soft caps (invariant #2): per-scan ceiling on cumulative
  // DataForSEO + Tavily USD (in cents). On breach the pipeline DEGRADES (skips
  // remaining external enrichment) — it never throws mid-step.
  EXTERNAL_SCAN_CAP_CENTS_FREE: z.coerce.number().int().positive().default(25),
  EXTERNAL_SCAN_CAP_CENTS_FULL: z.coerce.number().int().positive().default(150),
  // Cost-alert thresholds (observe-only; console + a persisted `cost-alert`
  // scan event surfaced on /app/diagnostics — never breaks a scan).
  COST_ALERT_SCAN_CENTS: z.coerce.number().int().positive().default(150),
  COST_ALERT_USER_DAILY_CENTS: z.coerce.number().int().positive().default(500),
  // Tavily bills in credits, not dollars, and returns no cost in its response.
  // This is the $/credit rate for our plan, used to price each call for per-scan
  // cost accounting (DataForSEO returns real USD, so it needs no such rate).
  // Default ≈ Tavily pay-as-you-go ($8 / 1,000 credits); override per plan.
  TAVILY_USD_PER_CREDIT: z.coerce.number().nonnegative().default(0.008),
  // Owner allowlist for internal-only surfaces (/app/diagnostics). Empty →
  // owner tools are dev-only and fail closed in production (lib/auth/owner.ts).
  REACHKIT_OWNER_EMAILS: z.string().optional().default(""),
  // Verbose logging for the cohort-profile discovery pass.
  PROFILE_DEBUG: z.string().optional().transform((v) => v === "1"),
  // The only feature flag: keyless fixtures mode for tests / local dev.
  REACHKIT_USE_FIXTURES: z.string().optional().transform((v) => v === "true"),
}).superRefine((val, ctx) => {
  // superRefine receives transformed values: val.REACHKIT_USE_FIXTURES is a boolean.
  if (!val.REACHKIT_USE_FIXTURES) {
    for (const key of [...PAID_KEYS, ...STRIPE_REQUIRED_KEYS]) {
      if (!val[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required unless REACHKIT_USE_FIXTURES=true`,
        });
      }
    }
  }
});

export function parseEnv(src: NodeJS.ProcessEnv) {
  const p = schema.parse(src);
  return {
    supabaseUrl: p.SUPABASE_URL, supabaseAnonKey: p.SUPABASE_ANON_KEY, supabaseServiceKey: p.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: p.ANTHROPIC_API_KEY, dataforseoLogin: p.DATAFORSEO_LOGIN, dataforseoPassword: p.DATAFORSEO_PASSWORD,
    tavilyApiKey: p.TAVILY_API_KEY, resendApiKey: p.RESEND_API_KEY,
    posthogKey: p.POSTHOG_KEY, posthogHost: p.POSTHOG_HOST, scanBudgetCents: p.SCAN_BUDGET_CENTS,
    weeklyRefreshBudgetCents: p.WEEKLY_REFRESH_BUDGET_CENTS,
    externalScanCapCentsFree: p.EXTERNAL_SCAN_CAP_CENTS_FREE,
    externalScanCapCentsFull: p.EXTERNAL_SCAN_CAP_CENTS_FULL,
    costAlertScanCents: p.COST_ALERT_SCAN_CENTS,
    costAlertUserDailyCents: p.COST_ALERT_USER_DAILY_CENTS,
    costAlertWebhookUrl: p.COST_ALERT_WEBHOOK_URL,
    scanningEnabled: p.SCANNING_ENABLED,
    productHuntToken: p.PRODUCT_HUNT_TOKEN, youtubeApiKey: p.YOUTUBE_API_KEY,
    voyageApiKey: p.VOYAGE_API_KEY,
    dataforseoLocationCode: p.DATAFORSEO_LOCATION_CODE, dataforseoLanguageCode: p.DATAFORSEO_LANGUAGE_CODE,
    tavilyUsdPerCredit: p.TAVILY_USD_PER_CREDIT,
    useFixtures: p.REACHKIT_USE_FIXTURES,
    inngestSigningKey: p.INNGEST_SIGNING_KEY,
    billingGraceDays: p.BILLING_GRACE_DAYS,
    ownerEmails: p.REACHKIT_OWNER_EMAILS,
    profileDebug: p.PROFILE_DEBUG,
    appUrl: p.APP_URL,
    stripeSecretKey: p.STRIPE_SECRET_KEY,
    stripeWebhookSecret: p.STRIPE_WEBHOOK_SECRET,
    stripePriceSolo: p.STRIPE_PRICE_SOLO,
    stripePriceGrowth: p.STRIPE_PRICE_GROWTH,
    stripePriceSoloAnnual: p.STRIPE_PRICE_SOLO_ANNUAL,
    stripePriceGrowthAnnual: p.STRIPE_PRICE_GROWTH_ANNUAL,
  };
}

export type Env = ReturnType<typeof parseEnv>;

let _env: Env | undefined;
export const env: Env = new Proxy({} as Env, {
  get: (_t, prop) => (_env ??= parseEnv(process.env))[prop as keyof Env],
});
