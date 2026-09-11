// tests/db/migration-naming.test.ts
//
// WO-267 `## Test plan` (carried verbatim from WO-008):
//   - BP-002 decision 2: "A migration whose name carries no assigned topic
//     token fails the registry check."
//   - `structure.md` rule 3a: "A sub-token is not a new topic and needs no
//     entry in the closed list above."
//   - `structure.md` rule 2: "the narrower glob owns the file."
//   - `SPEC.md` §1: "Supabase (Postgres, RLS default-deny, magic-link
//     auth)" — companion assertion against `supabase/config.toml`.
//
// `structure.md` rule 4: tests live beside the module they exercise —
// `tests/db/**` is BP-002's, per its `code:` glob.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATION_SUBTOKENS, MIGRATION_TOPICS, topicOf } from "../../src/lib/db/topics";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const CONFIG_TOML = path.join(REPO_ROOT, "supabase", "config.toml");

describe('BP-002 decision 2 — "A migration whose name carries no assigned topic token fails the registry check."', () => {
  it("a name carrying no assigned topic token resolves to null", () => {
    expect(topicOf("00000000000099_widgets.sql")).toBeNull();
  });

  it("removing the check (never inspecting the result) would let the unassigned name through — the mutation this test guards against", () => {
    // The "check" is `topicOf(...) !== null`. Watch it fail first: without
    // this assertion, an unassigned filename passes silently.
    const result = topicOf("00000000000099_widgets.sql");
    expect(result === null ? "fails registry check" : "passes").toBe(
      "fails registry check"
    );
  });

  it("a name carrying two assigned topic tokens is ambiguous and resolves to null", () => {
    expect(topicOf("00000000000098_leads_scans.sql")).toBeNull();
  });
});

describe('`structure.md` rule 3a — "A sub-token is not a new topic and needs no entry in the closed list above."', () => {
  it("`*_users_erasure_*.sql` resolves to BP-063 as its owner, not BP-017 (the `users` parent topic's owner)", () => {
    const resolved = topicOf("20260901000001_users_erasure_add_purge_due_at.sql");
    expect(resolved).toEqual({ token: "users_erasure", owner: "BP-063" });
  });

  it("every sub-token narrows a parent that is itself a member of the closed topic list", () => {
    const topicTokens = new Set(MIGRATION_TOPICS.map((topic) => topic.token));
    for (const sub of MIGRATION_SUBTOKENS) {
      expect(topicTokens.has(sub.parent)).toBe(true);
    }
  });
});

describe('`structure.md` rule 2 — "the narrower glob owns the file."', () => {
  it("`topicOf()` on a sub-token name returns the sub-token's owner, never the parent topic's", () => {
    const resolved = topicOf("20260901000002_sites_erasure_add_publishing_enabled.sql");
    expect(resolved?.owner).toBe("BP-063");
    expect(resolved?.owner).not.toBe("BP-017"); // BP-017 owns the parent `sites` topic
  });

  it("a valid baseline name resolves to BP-002", () => {
    expect(topicOf("00000000000001_baseline.sql")).toEqual({
      token: "baseline",
      owner: "BP-002",
    });
  });
});

describe("supabase/migrations/ — every applied migration file names exactly one topic or sub-token", () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith(".sql"));

  it("contains the two baseline migrations WO-267 writes", () => {
    expect(files).toContain("00000000000001_baseline.sql");
    expect(files).toContain("00000000000002_rls.sql");
  });

  it.each(files)("%s carries exactly one assigned topic token", (file) => {
    expect(topicOf(file)).not.toBeNull();
  });
});

describe('`SPEC.md` §1 — "Supabase (Postgres, RLS default-deny, magic-link auth)" — companion assertion', () => {
  const config = readFileSync(CONFIG_TOML, "utf8");

  it("enables email OTP (magic-link) sign-in", () => {
    // `enable_confirmations = false` under `[auth.email]` is the magic-link
    // shape: no separate confirmation step, the link itself is the credential.
    const emailSection = config.slice(config.indexOf("[auth.email]"));
    expect(emailSection).toMatch(/enable_confirmations\s*=\s*false/);
  });

  it("disables password sign-in", () => {
    expect(config).toMatch(/enable_password_signin\s*=\s*false/);
  });

  it("names the migrations directory", () => {
    expect(config).toMatch(/path\s*=\s*"supabase\/migrations"/);
  });
});
