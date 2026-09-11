// tests/app/env-example.test.ts
//
// WO-001 test plan criterion: `BUILD.md` §15's binding list — asserts
// `.env.example` names every binding in §15 plus `HOSTED_EDGE_CNAME_TARGET`
// (BP-005's `Env` note), and that every value is empty. Deleting a name
// fails it.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");

// Quoted verbatim from BUILD.md §15:
//   "SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
//    STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID RESEND_API_KEY
//    MAIL_FROM DATAFORSEO_LOGIN DATAFORSEO_PASSWORD ANTHROPIC_API_KEY
//    NANO_API_KEY (optional, defaults to ANTHROPIC_API_KEY)
//    INNGEST_SIGNING_KEY INNGEST_EVENT_KEY IP_HASH_SALT KILL_SWITCH
//    OWNER_EMAILS HOSTED_EDGE_CNAME_TARGET NEXT_PUBLIC_APP_URL";
//   "`DATABASE_URL` is required only by migration tooling."
//
// BP-005 decision 6 rebinds three of §15's rows: `SUPABASE_SERVICE_ROLE` is
// retired in favour of `SUPABASE_SERVICE_ROLE_KEY` (6a) — `.env.example`
// carries the new name below. `DATABASE_URL` stays on this list even though
// it left `Env` (6c): it is still the migration and test tooling's binding,
// and this file asserts `.env.example` names it as well as every binding
// `Env` reads — the two lists are no longer identical, and this is the one
// row where that is deliberate. `NANO_API_KEY` (6b, optional inside `Env`)
// still names a required row here — `.env.example` documents every binding
// a deployment may set, not `Env`'s narrower required-at-boot set. The two
// Inngest rows (#315) are on this list for the same reason: optional inside
// `Env`, required of a real deployment by `assertJobsBindings()`, and named
// here because a deployment must set them.
const REQUIRED_BINDINGS = [
  "DATABASE_URL",
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
] as const;

function readEnvExampleBindings(): Record<string, string> {
  const raw = readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const bindings: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    bindings[name] = value;
  }
  return bindings;
}

describe("BUILD §15 — .env.example binding list", () => {
  it.each(REQUIRED_BINDINGS)("names %s", (name) => {
    const bindings = readEnvExampleBindings();
    expect(bindings).toHaveProperty(name);
  });

  it("every value is empty — a real credential here is a defect", () => {
    const bindings = readEnvExampleBindings();
    for (const [name, value] of Object.entries(bindings)) {
      expect(value, `${name} must be blank in .env.example`).toBe("");
    }
  });

  it("names no binding outside the required set", () => {
    const bindings = readEnvExampleBindings();
    const extra = Object.keys(bindings).filter(
      (name) => !(REQUIRED_BINDINGS as readonly string[]).includes(name)
    );
    expect(extra).toEqual([]);
  });
});
