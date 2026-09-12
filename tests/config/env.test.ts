// tests/config/env.test.ts
//
// WO-005 `## Test plan` — criteria quoted from BP-005 (`satisfies: []`) and
// `BUILD.md` §15, not from a requirement (BP-005 carries no requirement
// ancestor for `env.ts` — see the work order's test-plan header note).
// `structure.md` rule 4 puts a module's tests at `tests/<module>/**`.
//
// WO-284 moved this file onto BP-005 decision 6's three bindings:
// `SUPABASE_SERVICE_ROLE` retired for `SUPABASE_SERVICE_ROLE_KEY` (6a),
// `NANO_API_KEY` optional and resolved to `ANTHROPIC_API_KEY` when absent
// (6b), `DATABASE_URL` out of `Env` entirely (6c). The step-1 red run this
// order's own `## Steps` names is `git log -p` on this file's history, not
// a block kept here — the suites below are what stands.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../../src/lib/config/env.ts";

const ENV_MODULE = "../../src/lib/config/env.ts";

// `BUILD.md` §15, verbatim:
//   "SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
//   STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID RESEND_API_KEY
//   MAIL_FROM DATAFORSEO_LOGIN DATAFORSEO_PASSWORD ANTHROPIC_API_KEY
//   NANO_API_KEY (optional, defaults to ANTHROPIC_API_KEY)
//   INNGEST_SIGNING_KEY INNGEST_EVENT_KEY IP_HASH_SALT KILL_SWITCH
//   OWNER_EMAILS HOSTED_EDGE_CNAME_TARGET NEXT_PUBLIC_APP_URL";
//   "`DATABASE_URL` is required only by migration tooling."
// BP-005 decision 6a and 6c are already in that text: `SUPABASE_SERVICE_ROLE_KEY`
// replaces `SUPABASE_SERVICE_ROLE`, one name end to end, no alias;
// `DATABASE_URL` is not a member. Issue #315 added §15's two jobs bindings,
// which the 2026-09-05 ruling had kept out of the schema, issue #81
// adds `MAIL_FROM` and issue #322 the two Vercel bindings — 21 names, `env`'s own key set (`NANO_API_KEY` stays a
// member; 6b makes it optional at the *schema* level, not absent from
// `Env`, and the two jobs bindings are optional for their own reason: only
// a real deployment must carry them, and `assertJobsBindings()` is what
// refuses one that does not).
const BINDING_NAMES = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "ANTHROPIC_API_KEY",
  "NANO_API_KEY",
  "IP_HASH_SALT",
  "KILL_SWITCH",
  "OWNER_EMAILS",
  "NEXT_PUBLIC_APP_URL",
  "HOSTED_EDGE_CNAME_TARGET",
  "INNGEST_SIGNING_KEY",
  "INNGEST_EVENT_KEY",
  // Issue #322 — SPEC §5's ruling of 2026-09-12: the customer's subdomain
  // is added to the project's domain list "through the Vercel Domains API
  // with our server-only token". Optional at the schema level for the same
  // reason the jobs pair is: a local build and the layout suite add no
  // domain to any project, and a deployment that carries neither attaches
  // nothing rather than failing to boot.
  "VERCEL_API_TOKEN",
  "VERCEL_PROJECT_ID",
] as const;

/** Issue #315's pair, named once here. */
const JOBS_BINDING_NAMES = ["INNGEST_SIGNING_KEY", "INNGEST_EVENT_KEY"] as const;

/** Issue #322's pair. Optional for their own reason (see above), so they
 *  are out of the no-default set exactly as the jobs pair is. */
const DOMAIN_BINDING_NAMES = ["VERCEL_API_TOKEN", "VERCEL_PROJECT_ID"] as const;

// The missing-binding it.each below (BP-005 `## Error & edge behavior`,
// "Every other binding keeps the no-default, no-fallback rule") excludes
// `NANO_API_KEY` — decision 6b's whole point is that its absence resolves
// rather than throws; that behaviour has its own suite further down.
// It also excludes the two jobs bindings (#315): a process that is not a
// deployment runs no job, so their absence is not a boot failure there —
// the suite further down holds what happens on a real deployment.
const NO_DEFAULT_BINDING_NAMES = BINDING_NAMES.filter(
  (name) =>
    name !== "NANO_API_KEY" &&
    !(JOBS_BINDING_NAMES as readonly string[]).includes(name) &&
    !(DOMAIN_BINDING_NAMES as readonly string[]).includes(name)
);

// WO-005 file plan's closed set of server-only bindings, moved onto 6a.
const SERVER_ONLY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "RESEND_API_KEY",
  "DATAFORSEO_PASSWORD",
  "ANTHROPIC_API_KEY",
  "NANO_API_KEY",
  "IP_HASH_SALT",
  "INNGEST_SIGNING_KEY",
  "INNGEST_EVENT_KEY",
  // Issue #322: a token that can add a domain to our project is the same
  // kind of secret as the nine above. `VERCEL_PROJECT_ID` is not — it
  // names a project, it does not open one.
  "VERCEL_API_TOKEN",
] as const;

// A complete, validly-shaped set of bindings. Values are fixtures, never
// real credentials — `tests/setup.ts` also refuses any real network call
// from this process.
const VALID_ENV: Record<(typeof BINDING_NAMES)[number], string> = {
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
  NANO_API_KEY: "nano-fixture",
  IP_HASH_SALT: "salt-fixture",
  KILL_SWITCH: "false",
  OWNER_EMAILS: "owner@example.com,second-owner@example.com",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  HOSTED_EDGE_CNAME_TARGET: "content.reachkit-edge.example.com",
  INNGEST_SIGNING_KEY: "signkey-fixture",
  INNGEST_EVENT_KEY: "event-key-fixture",
  VERCEL_API_TOKEN: "vercel-token-fixture-do-not-leak",
  VERCEL_PROJECT_ID: "prj_fixture",
};

const ORIGINAL_ENV = { ...process.env };

/** Resets the 21 bindings to a complete, valid set, then applies overrides.
 * `undefined` deletes the key — `process.env[k] = undefined` would instead
 * coerce to the string `"undefined"`, which is not what "missing" means.
 * Also always clears `DATABASE_URL` and the retired `SUPABASE_SERVICE_ROLE`
 * name from `process.env` first, so a value left behind by another test
 * file cannot make a decision-6c or decision-6a case pass by accident —
 * callers that want either name present set it explicitly afterward. */
function applyEnv(overrides: Partial<Record<string, string | undefined>>) {
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE;
  // `isRealDeployment()` reads this one, and the jobs suite below turns on
  // the answer. A `VERCEL` inherited from somewhere else would decide it.
  delete process.env.VERCEL;
  for (const name of BINDING_NAMES) delete process.env[name];
  for (const [key, value] of Object.entries(VALID_ENV)) {
    process.env[key] = value;
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

/** `env.ts` parses at module load (BP-005), so observing a fresh parse
 * requires a fresh module instance — `vi.resetModules()` before every
 * import, per binding under test. */
async function importEnvModule(): Promise<{
  env: Record<string, unknown>;
  assertJobsBindings: () => void;
  MissingJobsBindings: new (missing: readonly string[]) => Error;
}> {
  vi.resetModules();
  return import(ENV_MODULE);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('BP-005 error behaviour — "`env` throws at boot on a missing or malformed binding; there is no default and no fallback, so a deployment cannot start half-configured." (BP-005 `## Error & edge behavior`: "Every other binding keeps the no-default, no-fallback rule.")', () => {
  it.each(NO_DEFAULT_BINDING_NAMES)("throws at module load when %s is missing", async (name) => {
    applyEnv({ [name]: undefined });
    await expect(importEnvModule()).rejects.toThrow();
  });

  it("does not throw when every binding is present and valid", async () => {
    applyEnv({});
    await expect(importEnvModule()).resolves.toBeDefined();
  });

  it("throws when KILL_SWITCH is not boolean-ish", async () => {
    applyEnv({ KILL_SWITCH: "not-a-boolean" });
    await expect(importEnvModule()).rejects.toThrow();
  });

  it("throws when OWNER_EMAILS contains a malformed address", async () => {
    applyEnv({ OWNER_EMAILS: "not-an-email" });
    await expect(importEnvModule()).rejects.toThrow();
  });

  it("throws when a URL binding is malformed", async () => {
    applyEnv({ SUPABASE_URL: "not-a-url" });
    await expect(importEnvModule()).rejects.toThrow();
  });

  it("throws when a plain-string binding is empty", async () => {
    applyEnv({ STRIPE_PRICE_ID: "" });
    await expect(importEnvModule()).rejects.toThrow();
  });
});

describe("BUILD §15's binding list, moved onto BP-005 decision 6", () => {
  it("env's key set equals the new 19-name list — an extra binding fails; a missing one fails", async () => {
    applyEnv({});
    const { env } = await importEnvModule();
    expect(Object.keys(env).sort()).toEqual([...BINDING_NAMES].sort());
  });
});

describe("BUILD §15's `MAIL_FROM` — the mailbox every ReachKit mail comes from (issue #81)", () => {
  it("throws at module load when it is not an address", async () => {
    applyEnv({ MAIL_FROM: "reachkit.app" });
    await expect(importEnvModule()).rejects.toThrow();
  });

  it("is read from env, not derived from NEXT_PUBLIC_APP_URL's host", async () => {
    applyEnv({ MAIL_FROM: "post@another.example", NEXT_PUBLIC_APP_URL: "https://app.example.com" });
    const { env } = await importEnvModule();
    expect(env.MAIL_FROM).toBe("post@another.example");
  });

  it("is not server-only: it is printed in the header of every mail we send", async () => {
    applyEnv({});
    const { env } = await importEnvModule();
    vi.stubGlobal("window", {});
    expect(() => env.MAIL_FROM).not.toThrow();
  });
});

describe('BP-005 `## Public interface` — "`HOSTED_EDGE_CNAME_TARGET` — the hostname a customer points `content.{their-domain}` at … It is one deployment-scoped hostname, so it is a binding rather than a constant"', () => {
  it("is read from env, tracking process.env rather than a fixed constant", async () => {
    applyEnv({ HOSTED_EDGE_CNAME_TARGET: "content.another-deployment.example.com" });
    const { env } = await importEnvModule();
    expect(env.HOSTED_EDGE_CNAME_TARGET).toBe("content.another-deployment.example.com");
  });
});

describe('BP-002 error behaviour, applied to env\'s own secrets — "A `dbAdmin()` import from a client component is a build error, not a runtime one." (WO-011 guards dbAdmin(); this guards env\'s server-only bindings so the same secret cannot leak ahead of it)', () => {
  it.each(SERVER_ONLY_NAMES)("%s throws when read from a client bundle", async (name) => {
    applyEnv({});
    const { env } = await importEnvModule();
    vi.stubGlobal("window", {});
    expect(() => env[name]).toThrow();
  });

  it.each(SERVER_ONLY_NAMES)("%s does not throw outside a client bundle", async (name) => {
    applyEnv({});
    const { env } = await importEnvModule();
    expect(() => env[name]).not.toThrow();
  });

  it("a non-server-only binding does not throw when read from a client bundle", async () => {
    applyEnv({});
    const { env } = await importEnvModule();
    vi.stubGlobal("window", {});
    expect(() => env.NEXT_PUBLIC_APP_URL).not.toThrow();
  });
});

describe('BP-005 decision 6, owner ruling relayed on BP-005 decision 6 (2026-09-04): "a fixture env carrying the old names must fail loudly" / "the new shape must boot"', () => {
  it("a fixture carrying the retired SUPABASE_SERVICE_ROLE name (not SUPABASE_SERVICE_ROLE_KEY) throws at module load, and the message names the missing binding", async () => {
    applyEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
    process.env.SUPABASE_SERVICE_ROLE = "retired-name-fixture";
    await expect(importEnvModule()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("a fixture carrying exactly the new key set, and no DATABASE_URL, constructs env without throwing; env.SUPABASE_SERVICE_ROLE_KEY is the fixture's value", async () => {
    applyEnv({});
    expect(process.env.DATABASE_URL).toBeUndefined();
    const { env } = await importEnvModule();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(VALID_ENV.SUPABASE_SERVICE_ROLE_KEY);
  });
});

describe('BP-005 decision 6a — "One name end to end, not an alias… The process-env key and the `Env` member are both `SUPABASE_SERVICE_ROLE_KEY`; every reader (`dbAdmin()`\'s, and the server-only key set in this same file) moves with it."', () => {
  it("the key-set assertion names SUPABASE_SERVICE_ROLE_KEY and refuses SUPABASE_SERVICE_ROLE as an extra binding", async () => {
    applyEnv({});
    const { env } = await importEnvModule();
    const keys = Object.keys(env);
    expect(keys).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(keys).not.toContain("SUPABASE_SERVICE_ROLE");
  });
});

describe('BP-005 `## Error & edge behavior` — "`NANO_API_KEY` absent resolves to `ANTHROPIC_API_KEY` — another required member of this same schema, a credential the deployment has already supplied and this file has already validated, never a fabricated or hard-coded one"', () => {
  it("with NANO_API_KEY unset, env boots and env.NANO_API_KEY equals env.ANTHROPIC_API_KEY", async () => {
    applyEnv({ NANO_API_KEY: undefined });
    const { env } = await importEnvModule();
    expect(env.NANO_API_KEY).toBe(env.ANTHROPIC_API_KEY);
  });

  it("with NANO_API_KEY and ANTHROPIC_API_KEY set to different values, env.NANO_API_KEY is its own", async () => {
    applyEnv({ NANO_API_KEY: "nano-own-fixture", ANTHROPIC_API_KEY: "anthropic-fixture" });
    const { env } = await importEnvModule();
    expect(env.NANO_API_KEY).toBe("nano-own-fixture");
    expect(env.NANO_API_KEY).not.toBe(env.ANTHROPIC_API_KEY);
  });

  it("with NANO_API_KEY and ANTHROPIC_API_KEY both unset, env still throws — the fallback is a member, not a literal", async () => {
    applyEnv({ NANO_API_KEY: undefined, ANTHROPIC_API_KEY: undefined });
    await expect(importEnvModule()).rejects.toThrow();
  });
});

describe('BP-005 decision 6b — "The resolution happens inside this file, before any caller reads `env`, and the member\'s type is a required `string` either way — no caller can observe which key it received, and none is asked to choose."', () => {
  it("type-level: Env['NANO_API_KEY'] is string, not string | undefined — a runtime witness that `npm run typecheck` enforces at compile time", async () => {
    applyEnv({ NANO_API_KEY: undefined });
    const { env } = await importEnvModule();
    // If `NANO_API_KEY` were `string | undefined` at the type level, this
    // runtime check would still pass after the resolution above — the type
    // witness functions below are what `npm run typecheck` actually polices;
    // this assertion is the corresponding runtime fact.
    expect(typeof env.NANO_API_KEY).toBe("string");
  });
});

// Type witnesses (BP-005 decision 6b) — checked by `npm run typecheck`,
// never executed. `Env["NANO_API_KEY"]` must be a required `string`; making
// the member optional (reverting `Omit<ParsedEnv, "NANO_API_KEY"> & {
// NANO_API_KEY: string }` to a bare `z.infer`) fails this file's typecheck.
function _nanoApiKeyIsRequiredString(value: Env["NANO_API_KEY"]): string {
  return value;
}
void _nanoApiKeyIsRequiredString;

function _nanoApiKeyRejectsUndefined(): void {
  // @ts-expect-error — `Env["NANO_API_KEY"]` must not accept `undefined`;
  // an `.optional()`-shaped `Env` member would compile here instead.
  const value: Env["NANO_API_KEY"] = undefined;
  void value;
}
void _nanoApiKeyRejectsUndefined;

describe('BP-005 decision 6c — "**Out of `Env` entirely, not optional inside it**… `Env` is the *boot* contract; a member no module reads is a declaration promising a validation it no longer performs."', () => {
  it("env boots with DATABASE_URL absent from process.env", async () => {
    applyEnv({});
    expect(process.env.DATABASE_URL).toBeUndefined();
    await expect(importEnvModule()).resolves.toBeDefined();
  });

  it("DATABASE_URL is absent from env's key set", async () => {
    applyEnv({});
    const { env } = await importEnvModule();
    expect(Object.keys(env)).not.toContain("DATABASE_URL");
  });

  it("DATABASE_URL present in process.env (as the tooling's own binding) does not change env's key set or throw", async () => {
    applyEnv({});
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/reachkit";
    const { env } = await importEnvModule();
    expect(Object.keys(env)).not.toContain("DATABASE_URL");
  });
});

describe('issue #315 — BUILD §15 names `INNGEST_SIGNING_KEY INNGEST_EVENT_KEY`, and §11: "the app registers at `/api/jobs/[[...slug]]` with `INNGEST_SIGNING_KEY` / `INNGEST_EVENT_KEY`". They are members of this schema, reversing the 2026-09-05 ruling that kept them out', () => {
  it.each(JOBS_BINDING_NAMES)("%s is a member of env's key set", async (name) => {
    applyEnv({});
    const { env } = await importEnvModule();
    expect(Object.keys(env)).toContain(name);
  });

  it.each(JOBS_BINDING_NAMES)("%s reads back the binding's value", async (name) => {
    applyEnv({});
    const { env } = await importEnvModule();
    expect(env[name]).toBe(VALID_ENV[name]);
  });

  it("both are still keys of env when unset, so the server-only guard holds on every deployment and env's shape does not change with the environment", async () => {
    applyEnv({ INNGEST_SIGNING_KEY: undefined, INNGEST_EVENT_KEY: undefined });
    const { env } = await importEnvModule();
    expect(Object.keys(env).sort()).toEqual([...BINDING_NAMES].sort());
    for (const name of JOBS_BINDING_NAMES) expect(env[name]).toBeUndefined();
  });

  it.each(JOBS_BINDING_NAMES)("an empty %s is malformed, not absent, and fails the parse", async (name) => {
    applyEnv({ [name]: "" });
    await expect(importEnvModule()).rejects.toThrow();
  });

  it.each(JOBS_BINDING_NAMES)(
    "a process that is not a deployment boots with %s missing — it runs no job",
    async (name) => {
      applyEnv({ [name]: undefined, NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
      await expect(importEnvModule()).resolves.toBeDefined();
    }
  );
});

describe("issue #315 — the boot invariant: a real deployment that cannot run a job does not start", () => {
  it("is silent on a real deployment carrying both bindings", async () => {
    applyEnv({});
    const { assertJobsBindings } = await importEnvModule();
    expect(() => assertJobsBindings()).not.toThrow();
  });

  it.each(JOBS_BINDING_NAMES)("throws on a real deployment missing %s, and names it", async (name) => {
    applyEnv({ [name]: undefined });
    const { assertJobsBindings, MissingJobsBindings } = await importEnvModule();
    const thrown = (() => {
      try {
        assertJobsBindings();
        return null;
      } catch (error: unknown) {
        return error;
      }
    })();
    expect(thrown).toBeInstanceOf(MissingJobsBindings);
    expect(String(thrown)).toContain(name);
  });

  it("names both when both are missing, and no value of either", async () => {
    applyEnv({ INNGEST_SIGNING_KEY: undefined, INNGEST_EVENT_KEY: undefined });
    const { assertJobsBindings } = await importEnvModule();
    const message = String(
      (() => {
        try {
          assertJobsBindings();
          return null;
        } catch (error: unknown) {
          return error;
        }
      })()
    );
    for (const name of JOBS_BINDING_NAMES) expect(message).toContain(name);
    expect(message).not.toContain(VALID_ENV.INNGEST_SIGNING_KEY);
    expect(message).not.toContain(VALID_ENV.INNGEST_EVENT_KEY);
  });

  it("a Vercel deployment is real even on a loopback app URL — the platform binding decides first", async () => {
    applyEnv({ INNGEST_EVENT_KEY: undefined, NEXT_PUBLIC_APP_URL: "http://localhost:3000" });
    process.env.VERCEL = "1";
    const { assertJobsBindings } = await importEnvModule();
    expect(() => assertJobsBindings()).toThrow(/INNGEST_EVENT_KEY/);
  });

  it.each(["http://localhost:3000", "http://127.0.0.1:3000"])(
    "is silent at %s with neither binding set — a local build and the layout suite's server run no job",
    async (appUrl) => {
      applyEnv({
        INNGEST_SIGNING_KEY: undefined,
        INNGEST_EVENT_KEY: undefined,
        NEXT_PUBLIC_APP_URL: appUrl,
      });
      const { assertJobsBindings } = await importEnvModule();
      expect(() => assertJobsBindings()).not.toThrow();
    }
  );
});
