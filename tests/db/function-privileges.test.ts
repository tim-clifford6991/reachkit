// tests/db/function-privileges.test.ts — issue 1483
//
// Who a session may execute in `public`, and how every policy reads
// `auth.uid()`, asserted against the applied schema rather than migration
// text. `functions-search-path.test.ts` reads the text, which is what binds
// the migration a future PR writes; it cannot see an `alter function`, a
// `do` block, or a default privilege. This file reads `pg_proc` and
// `pg_policies` once every migration has run, so whatever statement opened
// a function, the gate sees the result.
//
//   1. **No function in `public` is executable by `anon` or `authenticated`**
//      unless it is allow-listed below with a reason — including through
//      `PUBLIC`, which every role inherits. Extension-owned functions
//      (`pg_trgm`'s) are not this schema's to grant; `docs/RUNBOOK.md` §9
//      carries their disposition.
//   2. **A function the next migration creates is closed by default.** The
//      database starts with the default privileges the production project
//      has (`pg_default_acl`: `postgres` grants `anon`, `authenticated` and
//      `service_role` execute on new functions in `public`), so the
//      migration that revokes them is what this proves.
//   3. **Every policy reads `auth.uid()` as `(select auth.uid())`** — the
//      advisor's `auth_rls_initplan` — and is otherwise the policy it was:
//      the same command, roles and predicate as before 20261017120000.
//
// A `db`-project suite (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`), run
// against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "./substrate";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../supabase/migrations");
const THIS_MIGRATION = "20261017120000_rls_privileges.sql";
const ALL = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const BEFORE = ALL.filter((name) => name < THIS_MIGRATION);
const FROM = ALL.filter((name) => name >= THIS_MIGRATION);

/** Who may run a function in `public` from a session, and why. A name here
 *  is a decision, not a default. Empty: every caller is `dbAdmin()`. */
const SESSION_EXECUTABLE: ReadonlyMap<string, string> = new Map<string, string>([]);

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function apply(files: readonly string[]): void {
  for (const file of files) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS_DIR, file)]);
}

/** The Postgres default (`PUBLIC` executes every new function) and the
 *  production project's own default privileges in `public`. */
function productionDefaults(): void {
  run(
    "alter default privileges grant execute on functions to public; " +
      "alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;"
  );
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

/** Every function in `public` a session may execute, by name and
 *  arguments — directly or through `PUBLIC`. */
function sessionExecutable(): string[] {
  return psqlRows(`
    select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
       and (has_function_privilege('anon', p.oid, 'execute')
            or has_function_privilege('authenticated', p.oid, 'execute'))
     order by 1;
  `).map((row) => row[0] ?? "");
}

function functionNames(): string[] {
  return psqlRows(`
    select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     order by 1;
  `).map((row) => row[0] ?? "");
}

const INITPLAN = /\(\s*SELECT\s+auth\.(uid|role|jwt)\(\)\s+AS\s+\w+\s*\)/gi;
const BARE = /\bauth\.(uid|role|jwt)\(\)|\bcurrent_setting\(/i;

interface Policy {
  readonly name: string;
  readonly shape: string;
}

/** Each policy in `public`: its table, command, roles and both
 *  expressions, as Postgres deparses them, on one line — a deparse spans
 *  several, and `psqlRows` splits rows on newlines. */
function policies(): Policy[] {
  return psqlRows(`
    select tablename || '.' || policyname,
           regexp_replace(
             permissive || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' USING ' || coalesce(qual, '-') || ' CHECK ' || coalesce(with_check, '-'),
             '[[:space:]]+', ' ', 'g')
      from pg_policies where schemaname = 'public' order by 1;
  `).map((row) => ({ name: row[0] ?? "", shape: row.slice(1).join("|") }));
}

/** The policies that still call an auth function once per row. */
function bareAuthCalls(): string[] {
  return policies()
    .filter((policy) => BARE.test(policy.shape.replace(INITPLAN, "")))
    .map((policy) => policy.name);
}

let policiesBefore: Policy[] = [];

beforeAll(() => {
  productionDefaults();
  resetSchema();
  productionDefaults();
  apply(BEFORE);
  policiesBefore = policies();
  apply(FROM);
});

afterAll(() => {
  // The global `PUBLIC` default is per database, not per schema: put it back
  // so a later suite in this database creates functions as it always has.
  resetSchema();
  run("alter default privileges grant execute on functions to public;");
});

describe("issue 1483 — no function in `public` is executable by a session unless allow-listed", () => {
  it("finds the functions the migrations create, and no fewer", () => {
    // A missing name means the sweep is reading the wrong schema and the
    // rule below is checking nothing.
    expect(functionNames()).toEqual(
      expect.arrayContaining([
        "apply_setup_choice",
        "known_content_near",
        "publish_transition",
        "redeem_veto_token",
        "save_publishing_settings",
        "store_current_report",
      ])
    );
  });

  it("`anon` and `authenticated` execute none outside the allow-list", () => {
    const open = sessionExecutable().filter((signature) => !SESSION_EXECUTABLE.has(signature.replace(/\(.*$/, "")));
    expect(open).toEqual([]);
  });

  it.each([...SESSION_EXECUTABLE])("%s is allow-listed with a reason", (_name, reason) => {
    expect(reason.trim()).not.toBe("");
  });

  it("`service_role` — `dbAdmin()` — still executes every one", () => {
    const closed = psqlRows(`
      select p.proname from pg_proc p
       where p.pronamespace = 'public'::regnamespace
         and not has_function_privilege('service_role', p.oid, 'execute');
    `);
    expect(closed).toEqual([]);
  });

  it("a session calling one is refused", () => {
    expect(() =>
      run("begin; set local role anon; select redeem_veto_token('x', now()); commit;")
    ).toThrow(/permission denied for function redeem_veto_token/);
  });

  it("a grant to a session is what fails — the mutation this test guards against", () => {
    run("grant execute on function redeem_veto_token(text, timestamptz) to authenticated;");
    try {
      expect(sessionExecutable()).toEqual(["redeem_veto_token(p_token_hash text, p_now timestamp with time zone)"]);
    } finally {
      run("revoke execute on function redeem_veto_token(text, timestamptz) from authenticated;");
    }
  });
});

describe("issue 1483 — a function the next migration creates is closed by default", () => {
  it("is executable by its owner and `service_role`, and by no session", () => {
    run("create function widgets_count() returns int language sql set search_path = '' as $$ select 1 $$;");
    try {
      expect(sessionExecutable()).toEqual([]);
      expect(psqlRows("select has_function_privilege('service_role', 'widgets_count()', 'execute');")).toEqual([["t"]]);
    } finally {
      run("drop function widgets_count();");
    }
  });

  it("a trigger it backs still fires on a session's own write", () => {
    // Postgres checks `execute` on a trigger function when the trigger is
    // created, never when it fires — why revoking the four trigger
    // functions leaves every customer write as it was.
    const user = "aaaaaaaa-1483-0000-0000-000000000001";
    run(
      `insert into users (id, email, plan_status) values ('${user}', 'owner@example.com', 'active');` +
        "create function users_mark() returns trigger language plpgsql set search_path = '' as $$ begin new.email := 'marked@example.com'; return new; end; $$;" +
        "create trigger users_mark before update on users for each row execute function users_mark();"
    );
    try {
      expect(psqlRows("select has_function_privilege('authenticated', 'users_mark()', 'execute');")).toEqual([["f"]]);
      run(
        "begin; set local role authenticated;" +
          `select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated"}', true);` +
          `update users set stripe_customer_id = 'cus_1' where id = '${user}'; commit;`
      );
      expect(psqlRows(`select email, stripe_customer_id from users where id = '${user}';`)).toEqual([
        ["marked@example.com", "cus_1"],
      ]);
    } finally {
      run(`drop trigger users_mark on users; drop function users_mark(); delete from users where id = '${user}';`);
    }
  });
});

describe("issue 1483 — advisor `auth_rls_initplan`: every policy reads `auth.uid()` once per statement", () => {
  it("finds the policies, and no fewer", () => {
    expect(policies().length).toBeGreaterThanOrEqual(22);
  });

  it("no policy calls an auth function bare", () => {
    expect(bareAuthCalls()).toEqual([]);
  });

  it("every policy is the one it was — same command, roles and predicate, with the call wrapped", () => {
    const unwrapped = policies().map((policy) => ({
      name: policy.name,
      shape: policy.shape.replace(INITPLAN, (_match, fn: string) => `auth.${fn}()`),
    }));
    expect(unwrapped).toEqual(policiesBefore);
  });

  it("a bare call is what fails — the mutation this test guards against", () => {
    run("create policy widgets_own on users for select to authenticated using (id = auth.uid());");
    try {
      expect(bareAuthCalls()).toEqual(["users.widgets_own"]);
    } finally {
      run("drop policy widgets_own on users;");
    }
  });
});
