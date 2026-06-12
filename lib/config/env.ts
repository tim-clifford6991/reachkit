import { z } from "zod";

const schema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  DATAFORSEO_LOGIN: z.string().min(1),
  DATAFORSEO_PASSWORD: z.string().min(1),
  TAVILY_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  POSTHOG_KEY: z.string().min(1),
  POSTHOG_HOST: z.string().url(),
  SCAN_BUDGET_CENTS: z.coerce.number().int().positive().default(150),
  PRODUCT_HUNT_TOKEN: z.string().min(1),
  DATAFORSEO_LOCATION_CODE: z.coerce.number().int().default(2840), // US
  DATAFORSEO_LANGUAGE_CODE: z.string().default("en"),
});

export function parseEnv(src: NodeJS.ProcessEnv) {
  const p = schema.parse(src);
  return {
    supabaseUrl: p.SUPABASE_URL, supabaseAnonKey: p.SUPABASE_ANON_KEY, supabaseServiceKey: p.SUPABASE_SERVICE_ROLE_KEY,
    anthropicApiKey: p.ANTHROPIC_API_KEY, dataforseoLogin: p.DATAFORSEO_LOGIN, dataforseoPassword: p.DATAFORSEO_PASSWORD,
    tavilyApiKey: p.TAVILY_API_KEY, resendApiKey: p.RESEND_API_KEY,
    posthogKey: p.POSTHOG_KEY, posthogHost: p.POSTHOG_HOST, scanBudgetCents: p.SCAN_BUDGET_CENTS,
    productHuntToken: p.PRODUCT_HUNT_TOKEN, dataforseoLocationCode: p.DATAFORSEO_LOCATION_CODE, dataforseoLanguageCode: p.DATAFORSEO_LANGUAGE_CODE,
  };
}

export type Env = ReturnType<typeof parseEnv>;

let _env: Env | undefined;
export const env: Env = new Proxy({} as Env, {
  get: (_t, prop) => (_env ??= parseEnv(process.env))[prop as keyof Env],
});
