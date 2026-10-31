// `signin_links`, against a live database: the sealed sign-in link is out of
// every customer session's reach, including the account it belongs to.
//
// A `db`-project suite (`scripts/live-schema-tests.mjs`), run against
// `scripts/db-substrate/` in CI's `schema · RLS` gate.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20261031120000_users_signin_link_reuse.sql"];

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function resetSchema(): void {
  const sql = "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;";
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
});

afterAll(() => {
  resetSchema();
});

describe("signin_links — service role only", () => {
  it("anon and authenticated hold no privilege on it, and no policy opens it", () => {
    expect(value("select relrowsecurity from pg_class where oid = 'public.signin_links'::regclass;")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'signin_links';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["select", "insert", "update", "delete", "truncate", "references", "trigger"]) {
        expect(value(`select has_table_privilege('${role}', 'public.signin_links', '${privilege}');`)).toBe("f");
      }
    }
    for (const privilege of ["select", "insert", "update", "delete"]) {
      expect(value(`select has_table_privilege('service_role', 'public.signin_links', '${privilege}');`)).toBe("t");
    }
  });

  it("users carries no sign-in link column a session could read through its own row", () => {
    expect(
      value("select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'users' and column_name like 'signin_link%';")
    ).toBe("0");
  });
});
