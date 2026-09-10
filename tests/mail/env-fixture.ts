// tests/mail/env-fixture.ts — the bindings `src/lib/config/env.ts` parses
// at module load. Set before the module under test is dynamically
// imported, exactly as `tests/db/rls.test.ts` does it: `env` validates
// `process.env` once, at import time, and throws on a missing binding.
export const ENV_FIXTURE: Readonly<Record<string, string>> = Object.freeze({
  SUPABASE_URL: "https://fixture.supabase.co",
  SUPABASE_ANON_KEY: "anon-fixture",
  SUPABASE_SERVICE_ROLE_KEY: "service-fixture",
  STRIPE_SECRET_KEY: "sk_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  STRIPE_PRICE_ID: "price_fixture",
  RESEND_API_KEY: "re_fixture",
  // #81: a mailbox at a host `NEXT_PUBLIC_APP_URL` does not name, so a
  // re-derived From cannot pass `tests/mail/vendor/vendor.test.ts`.
  MAIL_FROM: "post@mailbox.example",
  DATAFORSEO_LOGIN: "dfs-login-fixture",
  DATAFORSEO_PASSWORD: "dfs-password-fixture",
  ANTHROPIC_API_KEY: "sk-ant-fixture",
  NANO_API_KEY: "nano-fixture",
  IP_HASH_SALT: "salt-fixture",
  KILL_SWITCH: "false",
  OWNER_EMAILS: "owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://reachkit.example",
  HOSTED_EDGE_CNAME_TARGET: "content.example.com",
  // #315: this fixture's app URL is not a loopback name, so a process
  // carrying it is a real deployment and `assertJobsBindings()` asks for
  // both. Fixture values; no vendor is reached with them.
  INNGEST_SIGNING_KEY: "signkey-fixture",
  INNGEST_EVENT_KEY: "event-key-fixture",
});

export function applyEnvFixture(): void {
  for (const [key, value] of Object.entries(ENV_FIXTURE)) process.env[key] = value;
}
