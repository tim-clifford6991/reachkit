// tests/jobs/env-fixture.ts
//
// `src/lib/config/env.ts` parses `process.env` at module load and throws on
// a missing binding, so anything reaching the kill switch must be imported
// *after* this fixture is in place. The same pattern
// `tests/llm/seam.test.ts` and `tests/config/env.test.ts` both use, with
// `KILL_SWITCH` left as the one knob a test turns.
import { vi } from "vitest";

const BASE: Record<string, string> = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  MAIL_FROM: "hello@reachkit.example",
  DATAFORSEO_LOGIN: "dfs-login-fixture",
  DATAFORSEO_PASSWORD: "dfs-password-fixture",
  ANTHROPIC_API_KEY: "sk-ant-fixture",
  NANO_API_KEY: "sk-ant-nano-fixture",
  IP_HASH_SALT: "salt-fixture",
  OWNER_EMAILS: "owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  HOSTED_EDGE_CNAME_TARGET: "content.example.com",
  // #315: schema members since the jobs bindings joined `env.ts`. The SDK
  // reads them from `process.env` under these same names — which is what
  // `client-bindings.test.ts` holds. Fixtures; no queue is reached.
  INNGEST_SIGNING_KEY: "signkey-fixture",
  INNGEST_EVENT_KEY: "event-key-fixture",
};

/** Stubs a complete environment with the kill switch in the given
 *  position, and drops every module cached against the previous one. */
export function stubEnv(killSwitch: boolean): void {
  for (const [key, value] of Object.entries(BASE)) vi.stubEnv(key, value);
  vi.stubEnv("KILL_SWITCH", killSwitch ? "true" : "false");
  vi.resetModules();
}
