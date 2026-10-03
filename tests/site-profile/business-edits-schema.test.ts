// Issue #926 — `site_profile_edits`, against a live database.
//
// The migration's own claims, exercised rather than read: the table is keyed
// by site and carries no cascade (ADR-051 point 7, so the purge is what
// removes it), the four JSON columns refuse a shape no reader could use,
// and — the half that matters most — **RLS lets one account's owner read
// and write their own corrections and nobody else's.**
// A leak here would put one business's profile in another's writer.
//
// `tests/db/rls.test.ts` proves the baseline's own policies; this file proves
// the four this migration adds, which that one does not apply. It is a
// `db`-project suite (`vitest.config.ts`'s `LIVE_SCHEMA_TESTS`), so it runs
// against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { psql, psqlRows } from "../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const APPLIED = [
  "00000000000001_baseline.sql",
  "00000000000002_rls.sql",
  "20260912090000_sites_profile.sql",
  "20260921120000_sites_profile_edits.sql",
  "20261003130000_sites_profile_knowledge.sql",
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
let OTHER_ID = "";
let OWNED_SITE = "";
let OTHER_SITE = "";

function makeUser(email: string): string {
  const [row] = psqlRows(
    `insert into users (email, plan_status) values ('${email}', 'active') returning id;`
  );
  const id = row?.[0];
  if (!id) throw new Error(`user insert returned no id for ${email}`);
  return id;
}

function makeSite(userId: string, domain: string): string {
  const [row] = psqlRows(
    `insert into sites (user_id, domain) values ('${userId}', '${domain}') returning id;`
  );
  const id = row?.[0];
  if (!id) throw new Error(`site insert returned no id for ${domain}`);
  return id;
}

/** Runs `sql` as `authenticated` with `auth.uid()` set to `userId` — the
 *  same construction `tests/db/rls.test.ts` uses to put a policy under a
 *  real session rather than trusting the policy's text. */
function asUser(userId: string, sql: string): string[][] {
  return psqlRows(
    `set local role authenticated; ` +
      `set local "request.jwt.claims" = '{"sub":"${userId}","role":"authenticated"}'; ` +
      sql
  );
}

function asUserRaises(userId: string, sql: string): boolean {
  return raises(
    `begin; set local role authenticated; ` +
      `set local "request.jwt.claims" = '{"sub":"${userId}","role":"authenticated"}'; ` +
      sql +
      ` commit;`
  );
}

function columnOf(column: string): string[] {
  const [row] = psqlRows(
    `select data_type, is_nullable, coalesce(column_default, 'no default') from information_schema.columns ` +
      `where table_schema = 'public' and table_name = 'site_profile_edits' and column_name = '${column}';`
  );
  return row ?? [];
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  OWNER_ID = makeUser("owner-926@example.com");
  OTHER_ID = makeUser("other-926@example.com");
  OWNED_SITE = makeSite(OWNER_ID, "owned-926.example.com");
  OTHER_SITE = makeSite(OTHER_ID, "other-926.example.com");
});

afterAll(() => {
  resetSchema();
});

describe("#926 — the corrections are keyed by site and live with it", () => {
  it("one row per site, and the key is the site", () => {
    expect(columnOf("site_id")).toEqual(["uuid", "NO", "no default"]);
    const [row] = psqlRows(
      `select c.contype from pg_constraint c join pg_class t on t.oid = c.conrelid ` +
        `where t.relname = 'site_profile_edits' and c.contype = 'p';`
    );
    expect(row?.[0]).toBe("p");
  });

  it("a second row for the same site is unrepresentable", () => {
    psql(["-c", `insert into site_profile_edits (site_id) values ('${OWNED_SITE}');`]);
    expect(raises(`insert into site_profile_edits (site_id) values ('${OWNED_SITE}');`)).toBe(true);
    psql(["-c", `delete from site_profile_edits where site_id = '${OWNED_SITE}';`]);
  });

  it("the key carries no cascade, so a site cannot be deleted around its corrections", () => {
    // ADR-051 point 7: "the purge is the only deleter, and a cascade is a
    // delete nobody asked for." The guarantee the missing cascade buys is
    // this one — a delete that would silently drop a customer's decisions
    // fails instead, and `src/lib/account/lifecycle/purge.ts` is what
    // clears the row first.
    const doomed = makeSite(OWNER_ID, "doomed-926.example.com");
    psql(["-c", `insert into site_profile_edits (site_id) values ('${doomed}');`]);
    expect(raises(`delete from sites where id = '${doomed}';`)).toBe(true);

    // And the purge's own order works: the corrections, then the site.
    psql(["-c", `delete from site_profile_edits where site_id = '${doomed}';`]);
    expect(raises(`delete from sites where id = '${doomed}';`)).toBe(false);
  });

  it("the purge names this table, before `sites`", () => {
    // The other half of the same claim, and the half a schema cannot state:
    // a table with no cascade that nothing purges is a row that outlives the
    // account. Read off the purge's own source, the way
    // `tests/account/lifecycle/schema.test.ts` reads the migrations — the
    // order is a literal in that file, and exporting it to be asserted
    // would widen a module's surface for a test's convenience.
    const purge = readFileSync(
      path.resolve(import.meta.dirname, "../../src/lib/account/lifecycle/purge.ts"),
      "utf8"
    );
    const mine = purge.indexOf('table: "site_profile_edits"');
    const sites = purge.indexOf('table: "sites"');
    expect(mine, "purge.ts does not name site_profile_edits").toBeGreaterThan(-1);
    expect(sites).toBeGreaterThan(-1);
    expect(mine).toBeLessThan(sites);
  });

  it("every decision column defaults to no decision, so a bare row means nothing was corrected", () => {
    expect(columnOf("removed")).toEqual(["jsonb", "NO", "'{}'::jsonb"]);
    expect(columnOf("added")).toEqual(["jsonb", "NO", "'{}'::jsonb"]);
    expect(columnOf("seen")).toEqual(["jsonb", "NO", "'{}'::jsonb"]);
    expect(columnOf("facts_off")).toEqual(["jsonb", "NO", "'[]'::jsonb"]);
    // The reworded sentence is the one that is absent until they write it.
    expect(columnOf("job")).toEqual(["text", "YES", "no default"]);
  });
});

describe("#926 — a shape no reader could use is refused", () => {
  it("the three field-keyed columns must be objects, not arrays", () => {
    // An array here reads back as "no decisions at all", which would
    // silently restore every item the customer removed.
    for (const column of ["removed", "added", "seen"]) {
      expect(
        raises(
          `insert into site_profile_edits (site_id, ${column}) values ('${OTHER_SITE}', '[]'::jsonb);`
        ),
        column
      ).toBe(true);
    }
  });

  it("the switched-off facts must be an array, not an object", () => {
    expect(
      raises(
        `insert into site_profile_edits (site_id, facts_off) values ('${OTHER_SITE}', '{}'::jsonb);`
      )
    ).toBe(true);
  });

  it("the switched-off list and the reworded sentence are bounded", () => {
    const tooMany = JSON.stringify(Array.from({ length: 501 }, (_, i) => `p${i}`));
    expect(
      raises(
        `insert into site_profile_edits (site_id, facts_off) values ('${OTHER_SITE}', '${tooMany}'::jsonb);`
      )
    ).toBe(true);
    const tooLong = "x".repeat(2001);
    expect(
      raises(
        `insert into site_profile_edits (site_id, job) values ('${OTHER_SITE}', '${tooLong}');`
      )
    ).toBe(true);
  });

  it("the founder's answers and a site's knowledge are objects, empty until written (issue 1133)", () => {
    expect(columnOf("answers")).toEqual(["jsonb", "NO", "'{}'::jsonb"]);
    expect(
      raises(`insert into site_profile_edits (site_id, answers) values ('${OTHER_SITE}', '[]'::jsonb);`)
    ).toBe(true);
    expect(raises(`insert into site_profiles (domain, knowledge) values ('k.example', '[]'::jsonb);`)).toBe(true);
    expect(raises(`insert into site_profiles (domain) values ('k.example');`)).toBe(false);
    expect(psqlRows(`select knowledge::text from site_profiles where domain = 'k.example';`)).toEqual([["{}"]]);
  });

  it("a well-formed row is taken", () => {
    expect(
      raises(
        `insert into site_profile_edits (site_id, removed, added, seen, facts_off, job) values ` +
          `('${OTHER_SITE}', '{"products":["a"]}'::jsonb, '{"claims":["b"]}'::jsonb, ` +
          `'{"products":["a","c"]}'::jsonb, '["a passage"]'::jsonb, 'We fix bikes');`
      )
    ).toBe(false);
    psql(["-c", `delete from site_profile_edits where site_id = '${OTHER_SITE}';`]);
  });
});

describe("#926 — RLS: one account's corrections are its own", () => {
  beforeAll(() => {
    psql([
      "-c",
      `insert into site_profile_edits (site_id, job) values ('${OWNED_SITE}', 'owner sentence') ` +
        `on conflict (site_id) do update set job = 'owner sentence';`,
    ]);
  });

  it("the owner reads their own row", () => {
    const rows = asUser(OWNER_ID, `select job from site_profile_edits;`);
    expect(rows.map((row) => row[0])).toEqual(["owner sentence"]);
  });

  it("another account reads nothing of it", () => {
    // Not "reads an error": RLS hides rows, and the honest assertion is
    // that the other account's own view of the table is empty.
    expect(asUser(OTHER_ID, `select job from site_profile_edits;`)).toEqual([]);
  });

  it("another account cannot write a row against a site that is not theirs", () => {
    expect(
      asUserRaises(
        OTHER_ID,
        `insert into site_profile_edits (site_id, job) values ('${OWNED_SITE}', 'theirs');`
      )
    ).toBe(true);
  });

  it("the owner may write their own", () => {
    expect(
      asUserRaises(OWNER_ID, `update site_profile_edits set job = 'still theirs' where site_id = '${OWNED_SITE}';`)
    ).toBe(false);
  });

  it("another account's attempt to move the row does nothing — it cannot see it to move it", () => {
    // **The policy is right and this test's first version was wrong.** An
    // UPDATE by a non-owner is filtered by the policy's `using` clause
    // before `with check` is ever consulted: the owner's row is not visible
    // to them, so the statement matches **zero rows** and succeeds having
    // changed nothing. It does not raise, and expecting it to was a
    // misreading of how Postgres applies RLS to an UPDATE.
    //
    // So what is asserted is the thing that actually matters: nothing moved.
    const before = psqlRows(
      `select site_id from site_profile_edits where site_id = '${OWNED_SITE}';`
    );
    expect(before).toHaveLength(1);

    expect(
      asUserRaises(
        OTHER_ID,
        `update site_profile_edits set site_id = '${OTHER_SITE}' where site_id = '${OWNED_SITE}';`
      ),
      "the statement itself is not an error — it matches no row"
    ).toBe(false);

    // The row is still the owner's, and the other account still has none.
    expect(
      psqlRows(`select site_id from site_profile_edits where site_id = '${OWNED_SITE}';`)
    ).toHaveLength(1);
    expect(
      psqlRows(`select site_id from site_profile_edits where site_id = '${OTHER_SITE}';`)
    ).toHaveLength(0);
  });

  it("the owner cannot move their own row onto a site that is not theirs — the `with check` half", () => {
    // This is the case `with check` exists for, and the one the test above
    // cannot reach: the owner *can* see their row, so `using` passes and the
    // new value is what must be judged. Moving it onto a stranger's site
    // fails, and here the statement really does raise.
    expect(
      asUserRaises(
        OWNER_ID,
        `update site_profile_edits set site_id = '${OTHER_SITE}' where site_id = '${OWNED_SITE}';`
      )
    ).toBe(true);
    // And it is still where it was.
    expect(
      psqlRows(`select site_id from site_profile_edits where site_id = '${OWNED_SITE}';`)
    ).toHaveLength(1);
  });

  it("a tombstoned owner reads nothing — the same rule every other table follows", () => {
    const ghostId = makeUser("ghost-926@example.com");
    const ghostSite = makeSite(ghostId, "ghost-926.example.com");
    psql(["-c", `insert into site_profile_edits (site_id, job) values ('${ghostSite}', 'gone');`]);
    expect(asUser(ghostId, `select job from site_profile_edits;`).map((r) => r[0])).toEqual([
      "gone",
    ]);
    psql(["-c", `update users set deleted_at = now() where id = '${ghostId}';`]);
    expect(asUser(ghostId, `select job from site_profile_edits;`)).toEqual([]);
  });

  it("an anonymous visitor reads nothing at all", () => {
    // A free scan's visitor owns no site, so there is nothing here they
    // could correct — and no `anon` policy was written.
    expect(
      psqlRows(`set local role anon; select count(*) from site_profile_edits;`).map((r) => r[0])
    ).toEqual(["0"]);
  });
});
