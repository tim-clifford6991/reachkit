// Issue 1455 — `draft_days`, against a live database.
//
// One row per site and date. The publish-time alert is claimed once a date,
// as the store claims it (a null `missing_alerted_at` updated), an outcome no
// tick writes is refused, a site's days hold the site until the purge
// removes them first (ADR-051 point 7: no cascade), and no
// customer's session reaches the table.
//
// A `db`-project suite (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`), run
// against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "00000000000002_rls.sql", "20261015120000_jobs_draft_days.sql", "20261101120000_jobs_draft_days_stall_claim.sql"];

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function raises(sql: string): boolean {
  try {
    run(sql);
    return false;
  } catch {
    return true;
  }
}

function value(sql: string): string | undefined {
  return psqlRows(sql)[0]?.[0];
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

function site(): string {
  const user = value(`insert into users (email, plan_status) values ('owner-${Math.random()}@example.com', 'active') returning id;`);
  return value(`insert into sites (user_id, domain) values ('${user}', 'reachkit.app') returning id;`)!;
}

/** The store's claim: seed the row if there is none, then mark it once. */
function claim(siteId: string, date: string, column = "missing_alerted_at"): boolean {
  run(`insert into draft_days (site_id, publish_date) values ('${siteId}', '${date}') on conflict do nothing;`);
  return (
    value(
      `with told as (update draft_days set ${column} = now() where site_id = '${siteId}' and publish_date = '${date}' and ${column} is null returning 1) select count(*) from told;`
    ) === "1"
  );
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
});

afterAll(() => {
  resetSchema();
});

describe("draft_days — every draft day, with its reason", () => {
  it("keeps the due hour's reason, and a date is told about once", () => {
    const id = site();
    run(
      `insert into draft_days (site_id, publish_date, outcome, reason, decided_at) values ('${id}', '2026-10-15', 'no_page', 'generate:no_opportunity', now());`
    );
    expect(claim(id, "2026-10-15")).toBe(true);
    expect(claim(id, "2026-10-15")).toBe(false);
    expect(psqlRows(`select outcome, reason from draft_days where site_id = '${id}';`)).toEqual([["no_page", "generate:no_opportunity"]]);
    // A date the due hour never recorded is told about too, once.
    expect(claim(id, "2026-10-16")).toBe(true);
    expect(claim(id, "2026-10-16")).toBe(false);
  });

  it("a stall is claimed once on the day last delivered, beside that day's own claim, and the next delivery's day claims anew", () => {
    const id = site();
    run(`insert into draft_days (site_id, publish_date, outcome, decided_at) values ('${id}', '2026-10-14', 'drafted', now());`);
    expect(claim(id, "2026-10-14", "stall_alerted_at")).toBe(true);
    expect(claim(id, "2026-10-14", "stall_alerted_at")).toBe(false);
    expect(claim(id, "2026-10-14")).toBe(true);
    expect(claim(id, "2026-10-20", "stall_alerted_at")).toBe(true);
  });

  it("refuses an outcome no tick writes, and a site is deleted only after its days (ADR-051)", () => {
    const id = site();
    expect(raises(`insert into draft_days (site_id, publish_date, outcome) values ('${id}', '2026-10-15', 'maybe');`)).toBe(true);
    run(`insert into draft_days (site_id, publish_date, outcome) values ('${id}', '2026-10-15', 'drafted');`);
    expect(raises(`delete from sites where id = '${id}';`)).toBe(true);
    run(`delete from draft_days where site_id = '${id}';`);
    run(`delete from sites where id = '${id}';`);
    expect(value(`select count(*) from sites where id = '${id}';`)).toBe("0");
  });

  it("no customer's session reaches it", () => {
    expect(value("select relrowsecurity from pg_class where relname = 'draft_days';")).toBe("t");
    expect(value("select count(*) from pg_policies where tablename = 'draft_days';")).toBe("0");
    for (const role of ["anon", "authenticated"]) {
      expect(value(`select has_table_privilege('${role}', 'draft_days', 'select');`)).toBe("f");
    }
  });
});
