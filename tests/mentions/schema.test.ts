// Issue #1004 — `llm_mention_reads` and `llm_mentions`, against a live
// database.
//
// The migration's own claims, exercised rather than read: one read per site
// per Monday, a mention that cannot exist without the week it belongs to,
// neither key carrying a cascade (ADR-051 point 7, so the purge is what
// removes them), the status column admitting exactly the four sentences the
// cards can say, and RLS on with no policy — so a customer's session reaches
// neither table even though the site is theirs.
//
// `tests/db/rls.test.ts` proves the baseline's own policies; this file
// proves what this migration adds, which that one does not apply. It is a
// `db`-project suite (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`), so it runs
// against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = [
  "00000000000001_baseline.sql",
  "00000000000002_rls.sql",
  "20260922130000_sites_mentions_llm.sql",
];

function raises(sql: string): boolean {
  try {
    psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
    return false;
  } catch {
    return true;
  }
}

function resetSchema(): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
}

let OWNER_ID = "";
let OWNED_SITE = "";

function makeUser(email: string): string {
  const [row] = psqlRows(`insert into users (email, plan_status) values ('${email}', 'active') returning id;`);
  const id = row?.[0];
  if (!id) throw new Error(`user insert returned no id for ${email}`);
  return id;
}

function makeSite(userId: string, domain: string): string {
  const [row] = psqlRows(`insert into sites (user_id, domain) values ('${userId}', '${domain}') returning id;`);
  const id = row?.[0];
  if (!id) throw new Error(`site insert returned no id for ${domain}`);
  return id;
}

/** Whether `sql`, run as `authenticated` with `auth.uid()` set, is refused
 *  — the construction `tests/db/rls.test.ts` uses to put a table under a
 *  real session rather than trusting the migration's text. Wrapped in a
 *  transaction so the `set local` role is given back either way. */
function asUserRaises(userId: string, sql: string): boolean {
  return raises(
    `begin; set local role authenticated; ` +
      `set local "request.jwt.claims" = '{"sub":"${userId}","role":"authenticated"}'; ` +
      sql +
      ` commit;`
  );
}

function week(site: string, weekStart: string, status = "measured"): void {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `insert into llm_mention_reads (site_id, week_start, status) values ('${site}', date '${weekStart}', '${status}');`,
  ]);
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  OWNER_ID = makeUser("owner-1004@example.com");
  OWNED_SITE = makeSite(OWNER_ID, "owned-1004.example.com");
});

afterAll(() => {
  resetSchema();
});

describe("#1004 — one read per site per local Monday", () => {
  it("a second read of the same week is unrepresentable, so no week is counted twice in the window", () => {
    week(OWNED_SITE, "2026-09-21");
    expect(
      raises(
        `insert into llm_mention_reads (site_id, week_start, status) values ('${OWNED_SITE}', date '2026-09-21', 'zero');`
      )
    ).toBe(true);
  });

  it("the four statuses are the only ones a row can carry", () => {
    for (const status of ["measured", "zero", "skipped_cap", "failed"]) {
      expect(
        raises(
          `insert into llm_mention_reads (site_id, week_start, status) values ('${OWNED_SITE}', date '2026-01-0${String(["measured", "zero", "skipped_cap", "failed"].indexOf(status) + 1)}', '${status}');`
        )
      ).toBe(false);
    }
    // A fifth word is a sentence no card knows how to say.
    expect(
      raises(
        `insert into llm_mention_reads (site_id, week_start, status) values ('${OWNED_SITE}', date '2026-02-01', 'probably');`
      )
    ).toBe(true);
  });

  it("the vendor's total is null where it gave none, never 0 — and a negative one is refused", () => {
    const [row] = psqlRows(
      `select total_count is null from llm_mention_reads where site_id = '${OWNED_SITE}' and week_start = date '2026-09-21';`
    );
    expect(row?.[0]).toBe("t");
    expect(
      raises(
        `insert into llm_mention_reads (site_id, week_start, status, total_count) values ('${OWNED_SITE}', date '2026-03-01', 'measured', -1);`
      )
    ).toBe(true);
  });

  it("cost is cents to four decimal places, so the row and fetches.cost_cents agree without rounding", () => {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into llm_mention_reads (site_id, week_start, status, cost_cents) values ('${OWNED_SITE}', date '2026-04-01', 'measured', 10.1000);`,
    ]);
    const [row] = psqlRows(
      `select cost_cents from llm_mention_reads where site_id = '${OWNED_SITE}' and week_start = date '2026-04-01';`
    );
    // A sub-cent price that an integer column would have rejected outright
    // — the defect issue #449 fixed on `fetches`, not repeated here.
    expect(Number(row?.[0])).toBeCloseTo(10.1, 4);
  });
});

describe("#1004 — a mention cannot exist without the week it was bought in", () => {
  it("a mention for a week with no read row is refused", () => {
    expect(
      raises(
        `insert into llm_mentions (site_id, week_start, question) values ('${OWNED_SITE}', date '2026-09-14', 'an orphan week');`
      )
    ).toBe(true);
  });

  it("a question survives with no cited page — the card is a list of questions", () => {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into llm_mentions (site_id, week_start, question) values ('${OWNED_SITE}', date '2026-09-21', 'replace wax seal toilet');`,
    ]);
    const [row] = psqlRows(
      `select question, cited_url is null, ai_search_volume is null from llm_mentions where site_id = '${OWNED_SITE}' and week_start = date '2026-09-21';`
    );
    expect(row).toEqual(["replace wax seal toilet", "t", "t"]);
  });

  it("there is no column a rank position or a sentiment could be stored in", () => {
    // SPEC §4 (2026-09-20) and #1004: "never a rank position, never
    // sentiment". A column that does not exist is the only way a later
    // surface cannot render one.
    const columns = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'llm_mentions';`
    ).map((row) => row[0]);
    for (const name of columns) {
      expect(name).not.toMatch(/rank|position|sentiment|score/i);
    }
  });
});

describe("#1004 — neither key cascades, and the purge is what deletes", () => {
  it("a site cannot be deleted around its mentions, and the purge's own order works", () => {
    const doomed = makeSite(OWNER_ID, "doomed-1004.example.com");
    week(doomed, "2026-09-21");
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `insert into llm_mentions (site_id, week_start, question) values ('${doomed}', date '2026-09-21', 'q');`,
    ]);

    expect(raises(`delete from sites where id = '${doomed}';`)).toBe(true);
    // And a week cannot be deleted around the mentions that point at it.
    expect(raises(`delete from llm_mention_reads where site_id = '${doomed}';`)).toBe(true);

    // `PURGE_ORDER`: the mentions, then the weeks, then the site.
    psql(["-c", `delete from llm_mentions where site_id = '${doomed}';`]);
    psql(["-c", `delete from llm_mention_reads where site_id = '${doomed}';`]);
    expect(raises(`delete from sites where id = '${doomed}';`)).toBe(false);
  });
});

describe("#1004 — RLS is on and neither table has a policy", () => {
  it("both tables have row level security enabled", () => {
    const rows = psqlRows(
      `select relname, relrowsecurity from pg_class where relname in ('llm_mentions', 'llm_mention_reads') order by relname;`
    );
    expect(rows).toEqual([
      ["llm_mention_reads", "t"],
      ["llm_mentions", "t"],
    ]);
  });

  it("no policy is declared on either, so default-deny is what a session meets", () => {
    const [row] = psqlRows(
      `select count(*) from pg_policies where schemaname = 'public' and tablename in ('llm_mentions', 'llm_mention_reads');`
    );
    expect(row?.[0]).toBe("0");
  });

  it("neither table is granted to anon or authenticated at all — the refusal is at the grant, before RLS", () => {
    // Stronger than an empty result, and deliberately so: with no table
    // grant a session is refused outright rather than shown zero rows, so
    // a policy accidentally added later still cannot open the table to a
    // browser. `service_role` holds the four privileges and nothing else
    // does — `dbAdmin()` is the only reader, exactly as it already is for
    // the stored weekly reports the same tab draws.
    const grants = psqlRows(
      `select grantee, table_name from information_schema.role_table_grants ` +
        `where table_schema = 'public' and table_name in ('llm_mentions', 'llm_mention_reads') ` +
        `and grantee in ('anon', 'authenticated', 'service_role') group by grantee, table_name order by table_name, grantee;`
    );
    expect(grants).toEqual([
      ["service_role", "llm_mention_reads"],
      ["service_role", "llm_mentions"],
    ]);
  });

  it("the site's own owner is refused by their own session, although the site is theirs", () => {
    expect(
      asUserRaises(OWNER_ID, `select count(*) from llm_mentions where site_id = '${OWNED_SITE}';`)
    ).toBe(true);
  });
});
