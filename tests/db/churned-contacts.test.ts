// `churned_contacts`, against a live database: only `service_role` reaches it, and it holds the five fields alone.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "./substrate";
const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20261115200000_users_erasure_churned_contacts.sql"];
const value = (sql: string): string | undefined => psqlRows(sql)[0]?.[0];
const reset = (): void => void psql(["-v", "ON_ERROR_STOP=1", "-c", "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;"]);
beforeAll(() => {
  reset();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
});
afterAll(reset);
describe("churned_contacts — denied to every customer session", () => {
  it("RLS is on, no policy, no anon or authenticated privilege, and only the five fields", () => {
    expect(value("select relrowsecurity from pg_class where relname = 'churned_contacts';")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'churned_contacts';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      for (const privilege of ["select", "insert", "update", "delete"]) {
        expect(value(`select has_table_privilege('${role}', 'churned_contacts', '${privilege}');`)).toBe("f");
      }
    }
    expect(value("select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_name = 'churned_contacts';")).toBe("churned_at,email,invited_at,name,reason");
  });
});
