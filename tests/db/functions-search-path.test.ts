// tests/db/functions-search-path.test.ts — issue #384
//
// Two rules about the applied schema's *security posture*, kept as rules
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
//
// **A text test, deliberately.** The live-schema project's file list lives
// in `vitest.config.ts`, which a feature PR may not edit (CLAUDE.md), so
// this runs in the `node` project and reads `supabase/migrations/` instead
// of a database. That is not only the possible shape but the useful one:
// the rules bind the *migration a future PR writes*, and a text sweep fails
// on the PR that adds an unpinned function rather than the deploy that
// re-runs the advisor. The applied-schema side is verified by hand against
// the substrate (`pg_proc.proconfig`) and re-checked by the advisor after
// the merge, both recorded in #384.
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
    // identity moved onto Supabase Auth.
    expect(policyLess).toEqual(["domain_blocks", "email_suppressions", "fetches"]);
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
