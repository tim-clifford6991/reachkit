// tests/db/functions-search-path.test.ts — issue #384
//
// Three rules about the applied schema's *security posture*, kept as rules
// rather than as a one-off fix:
//
//   1. **Every function in `public` pins its own search path.** Without a
//      `set search_path` clause a function resolves the tables it names on
//      whatever path its caller has set, so a role that may create objects
//      can shadow them — the Supabase security advisor's
//      `function_search_path_mutable`, which named all eight of this
//      schema's plpgsql functions after the 2026-09-08 cutover
//      (`docs/RUNBOOK.md` §11).
//   2. **A table with RLS on and no policy says so in a `comment on
//      table`.** Policy-less is the design here — `dbAdmin()`-only, §10
//      default-deny — but the advisor reads `pg_description`, not a
//      migration header, so the intent has to be written where it looks
//      (`rls_enabled_no_policy`).
//   3. **A `security definer` function is the service client's alone.** It
//      reads past RLS, so a session that may call it reads any site's rows
//      — `known_content_near` did until issue 1472
//      (`anon_security_definer_function_executable`). Its migrations revoke
//      `execute` from `public`, `anon` and `authenticated`, unless it is
//      allow-listed below with a reason.
//
// **A text test, deliberately.** The live-schema project's file list lives
// in `vitest.config.ts`, which a feature PR may not edit (CLAUDE.md), so
// this runs in the `node` project and reads `supabase/migrations/` instead
// of a database. That is not only the possible shape but the useful one:
// the rules bind the *migration a future PR writes*, and a text sweep fails
// on the PR that adds an unpinned function rather than the deploy that
// re-runs the advisor. The applied-schema side of rule 3 — who may execute
// any function in `public`, whatever statement granted it — is
// `function-privileges.test.ts`, in the `db` project (issue 1483).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../supabase/migrations");

/** Every migration, oldest first — the order Postgres applies them in, so
 *  the *last* definition of a function is the one that is live. */
const MIGRATIONS: readonly { name: string; sql: string }[] = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => ({ name, sql: readFileSync(path.join(MIGRATIONS_DIR, name), "utf8") }));

/** SQL with `--` line comments stripped: a rule about statements must not
 *  be satisfied — or broken — by prose. */
function statementsOf(sql: string): string {
  return sql.replace(/--[^\n]*/g, "");
}

// ── What the migrations declare ──────────────────────────────────────────

interface FunctionDefinition {
  readonly name: string;
  readonly migration: string;
  /** Everything from `create function` to the closing `$$;`. */
  readonly text: string;
}

const CREATE_FUNCTION = /create\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z0-9_]*)\s*\(/gi;

/** The last definition of each function in `public`, keyed by name. */
function liveFunctions(): Map<string, FunctionDefinition> {
  const live = new Map<string, FunctionDefinition>();
  for (const { name: migration, sql } of MIGRATIONS) {
    const statements = statementsOf(sql);
    for (const match of statements.matchAll(CREATE_FUNCTION)) {
      const name = match[1];
      const start = match.index;
      if (name === undefined || start === undefined) continue;
      const end = statements.indexOf("$$;", start);
      if (end === -1) throw new Error(`${migration}: ${name} has no closing $$;`);
      live.set(name, { name, migration, text: statements.slice(start, end + 3) });
    }
  }
  return live;
}

const FUNCTIONS = liveFunctions();

/** Every table this schema creates — the names a function body must not
 *  leave unqualified once its path is empty. */
const TABLES: ReadonlySet<string> = new Set(
  MIGRATIONS.flatMap(({ sql }) =>
    [...statementsOf(sql).matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)\s*\(/gi)].flatMap(
      (match) => (match[1] === undefined ? [] : [match[1]])
    )
  )
);

// ── 1. Every function pins its search path ───────────────────────────────

describe('advisor `function_search_path_mutable` — "a role-mutable search_path lets a caller shadow the tables a function names"', () => {
  it("finds every function the advisor named, and no fewer", () => {
    // The eight of #384. A ninth function is welcome; a missing one means
    // this file's parse has drifted from the migrations and the rules
    // below are silently checking nothing.
    for (const named of [
      "store_current_report",
      "opportunities_acceptance_is_immutable",
      "opportunities_touch_status_changed_at",
      "drafts_passage_is_immutable",
      "publish_transition",
      "redeem_veto_token",
      "save_publishing_settings",
      "apply_setup_choice",
    ]) {
      expect([...FUNCTIONS.keys()]).toContain(named);
    }
  });

  it.each([...FUNCTIONS.keys()])("%s carries a `set search_path` clause in its live definition", (name) => {
    const definition = FUNCTIONS.get(name);
    expect(definition).toBeDefined();
    expect(definition?.text).toMatch(/\bset\s+search_path\s*=/i);
  });

  it("an unpinned definition is what fails — the mutation this test guards against", () => {
    // Watch the rule fail first: the same body without the clause is
    // exactly what the advisor warned on, and must not pass.
    const unpinned = "create or replace function widgets_touch()\nreturns trigger\nlanguage plpgsql\nas $$ begin return new; end; $$;";
    expect(/\bset\s+search_path\s*=/i.test(unpinned)).toBe(false);
  });

  it.each([...FUNCTIONS.keys()])(
    "%s names every table of this schema schema-qualified, as an empty path requires",
    (name) => {
      const definition = FUNCTIONS.get(name);
      const bare: string[] = [];
      for (const match of (definition?.text ?? "").matchAll(
        /\b(?:update|insert\s+into|delete\s+from|join|from)\s+((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*)/gi
      )) {
        const reference = (match[1] ?? "").toLowerCase();
        const dot = reference.indexOf(".");
        const schema = dot === -1 ? undefined : reference.slice(0, dot);
        const table = dot === -1 ? reference : reference.slice(dot + 1);
        if (TABLES.has(table) && schema !== "public") bare.push(reference);
      }
      expect(bare).toEqual([]);
    }
  );
});

// ── 2. A policy-less table says why ──────────────────────────────────────

describe('advisor `rls_enabled_no_policy` — the tables that are policy-less by design say so where the advisor reads', () => {
  /** Tables with RLS enabled, and the tables any policy is written on. */
  const rlsOn = new Set<string>();
  const policied = new Set<string>();
  const commented = new Map<string, string>();
  /** Tables a later migration drops (`auth_links`, #468): no longer in
   *  `public`, so no longer the advisor's to name. */
  const dropped = new Set<string>();
  for (const { sql } of MIGRATIONS) {
    const statements = statementsOf(sql);
    for (const match of statements.matchAll(/drop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      if (match[1] !== undefined) dropped.add(match[1]);
    }
    for (const match of statements.matchAll(/alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi)) {
      if (match[1] !== undefined) rlsOn.add(match[1]);
    }
    for (const match of statements.matchAll(/create\s+policy\s+[^\n]*?\son\s+(?:public\.)?([a-z_][a-z0-9_]*)/gi)) {
      if (match[1] !== undefined) policied.add(match[1]);
    }
    // The statement terminator is a `;` at the end of a line: a `;` inside
    // the comment's own text ("dbAdmin()-only; ... ; ...") is not the end
    // of the statement, and a non-greedy match to the first `;` would cut
    // the sentence this file is checking for in half.
    for (const match of statements.matchAll(/comment\s+on\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+is\s+([\s\S]*?);[ \t]*(?:\n|$)/gi)) {
      if (match[1] !== undefined && match[2] !== undefined) commented.set(match[1], match[2]);
    }
  }
  const policyLess = [...rlsOn].filter((table) => !policied.has(table) && !dropped.has(table)).sort();

  it("finds the ones the advisor names in `public`", () => {
    // The advisor named six; two are v2's, in schema `v2_archive` (the
    // cutover's rollback path, `docs/RUNBOOK.md` §9) and not created
    // by any migration here, and `auth_links` was dropped by #468 when
    // identity moved onto Supabase Auth. `job_runs` (#799) is the job
    // heartbeat, written and read only by the job runner.
    // The two `llm_mention*` tables (#1004) are the Monday pass's LLM
    // Mentions week: written by the pass and read server-side by the AI
    // answers tab, exactly as that tab already reads the stored weekly
    // reports. They carry no `anon`/`authenticated` **grant** either, so a
    // session is refused at the grant, before RLS is consulted at all.
    // `rescore_runs` (issue 1433) is the master session's re-score request
    // and the job's answer to it. `draft_days` (issue 1455) is the draft
    // tick's per-site record of each day, written and read only by that job.
    // `refunds` is the first-14-days refund ledger, read and written only by the billing webhook.
    // `renewal_refunds` is the first-renewal refund ledger, written only by the same webhook.
    // `job_error_mails` is the job runner's once-a-Berlin-day claim on a failing job's owner mail.
    expect(policyLess).toEqual([
      "domain_blocks",
      "draft_days",
      "email_suppressions",
      "fetches",
      "job_error_mails",
      "job_runs",
      "llm_mention_reads",
      "llm_mentions",
      "refunds",
      "renewal_refunds",
      "rescore_runs",
      "vendor_days",
    ]);
  });

  it.each(policyLess)("%s carries a `comment on table` naming the rule", (table) => {
    const comment = commented.get(table);
    expect(comment, `${table} has no comment on table`).toBeDefined();
    expect(comment).toMatch(/dbAdmin\(\)-only/);
    expect(comment).toMatch(/default-deny/);
    expect(comment).toMatch(/no anon\/authenticated policy by design/);
  });

  it("a table that does carry a policy is not asked for the sentence", () => {
    // The rule is about the policy-less ones only: `scans` is policied and
    // must not appear in the list this file checks.
    expect(policied.has("scans")).toBe(true);
    expect(policyLess).not.toContain("scans");
  });
});

// ── 3. A `security definer` function is not callable from a session ──────

/** Who may run a `security definer` function from a session, and why. A
 *  definer function reads past RLS, so a name here is a decision, not a
 *  default. Empty: every one in this schema is the service client's. */
const SESSION_CALLABLE_DEFINERS: ReadonlyMap<string, string> = new Map<string, string>([]);

/** The roles a session reaches the database as. `public` is every role,
 *  and Postgres grants it `execute` on each new function; Supabase's default
 *  privileges grant `anon` and `authenticated` the same. */
const SESSION_ROLES = ["public", "anon", "authenticated"] as const;

const PRIVILEGE_STATEMENT =
  /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\(|\b(revoke|grant)\s+(?:all(?:\s+privileges)?|execute)\s+on\s+function\s+(?:public\.)?([a-z_][a-z0-9_]*)\s*\([^)]*\)\s+(?:from|to)\s+([a-z_,\s]+?)\s*;/gi;

/** The roles that may execute `name` once `migrations` have run, from its
 *  last `create function` on. A definition starts from the default grants:
 *  Postgres keeps a replaced function's grants, but the migration that
 *  changes a definer function is the one a reviewer reads, so it states
 *  them again. */
function executableBy(migrations: readonly { sql: string }[], name: string): Set<string> {
  let roles = new Set<string>();
  for (const { sql } of migrations) {
    for (const match of statementsOf(sql).matchAll(PRIVILEGE_STATEMENT)) {
      if (match[1] !== undefined) {
        if (match[1] === name) roles = new Set([...SESSION_ROLES, "service_role"]);
        continue;
      }
      if (match[3] !== name) continue;
      for (const role of (match[4] ?? "").split(",").map((r) => r.trim().toLowerCase())) {
        if (match[2]?.toLowerCase() === "grant") roles.add(role);
        else roles.delete(role);
      }
    }
  }
  return roles;
}

const DEFINERS = [...FUNCTIONS.values()]
  .filter((definition) => /\bsecurity\s+definer\b/i.test(definition.text))
  .map((definition) => definition.name);

describe('advisor `anon_security_definer_function_executable` — "a definer function a session can call reads past RLS"', () => {
  it("finds the definer function the advisor named, and no fewer", () => {
    // Issue 1472. A missing one means the parse has drifted and the rule
    // below is checking nothing.
    expect(DEFINERS).toContain("known_content_near");
  });

  it.each(DEFINERS.filter((name) => !SESSION_CALLABLE_DEFINERS.has(name)))(
    "%s is executable by `service_role` alone",
    (name) => {
      const roles = executableBy(MIGRATIONS, name);
      expect(SESSION_ROLES.filter((role) => roles.has(role))).toEqual([]);
      expect(roles.has("service_role")).toBe(true);
    }
  );

  it.each([...SESSION_CALLABLE_DEFINERS])("%s is allow-listed with a reason", (_name, reason) => {
    expect(reason.trim()).not.toBe("");
  });

  it("a grant to `service_role` without the revokes is what fails — the mutation this test guards against", () => {
    // The shape of 20260921150000_sites_content_known.sql before issue
    // 1472: granted to the service client, the default grants left in place.
    const create =
      "create or replace function widgets_near(p uuid)\nreturns int\nlanguage sql\nsecurity definer\nset search_path = ''\nas $$ select 1; $$;";
    const grant = "grant execute on function widgets_near(uuid) to service_role;";
    const revoke = "revoke all on function widgets_near(uuid) from public, anon, authenticated;";

    const open = executableBy([{ sql: `${create}\n${grant}` }], "widgets_near");
    expect(SESSION_ROLES.filter((role) => open.has(role))).toEqual(["public", "anon", "authenticated"]);

    const closed = executableBy([{ sql: `${create}\n${grant}` }, { sql: revoke }], "widgets_near");
    expect([...closed]).toEqual(["service_role"]);
  });
});
