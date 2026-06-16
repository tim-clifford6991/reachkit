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
  APP_URL: z.string().optional().default("http://localhost:3000"),
  SCAN_BUDGET_CENTS: z.coerce.number().int().positive().default(150),
  DATAFORSEO_LOCATION_CODE: z.coerce.number().int().default(2840), // US
  DATAFORSEO_LANGUAGE_CODE: z.string().default("en"),
  // Backlinks API is a separate DataForSEO subscription — off unless enabled.
  DATAFORSEO_BACKLINKS: z.string().optional().transform((v) => v === "true"),
  // M4 market analysis (cohort + demand + gap + plan) in the paid deep scan — off
  // until the report surfaces are validated.
  REACHKIT_MARKET_ANALYSIS: z.string().optional().transform((v) => v === "true"),
  REACHKIT_USE_FIXTURES: z.string().optional().transform((v) => v === "true"),
}).superRefine((val, ctx) => {
  // superRefine receives transformed values: val.REACHKIT_USE_FIXTURES is a boolean.
  if (!val.REACHKIT_USE_FIXTURES) {
    for (const key of PAID_KEYS) {
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
    productHuntToken: p.PRODUCT_HUNT_TOKEN, youtubeApiKey: p.YOUTUBE_API_KEY,
    voyageApiKey: p.VOYAGE_API_KEY,
    dataforseoLocationCode: p.DATAFORSEO_LOCATION_CODE, dataforseoLanguageCode: p.DATAFORSEO_LANGUAGE_CODE,
    dataforseoBacklinks: p.DATAFORSEO_BACKLINKS,
    marketAnalysis: p.REACHKIT_MARKET_ANALYSIS,
    useFixtures: p.REACHKIT_USE_FIXTURES,
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
