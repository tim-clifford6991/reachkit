// tests/publish/setup/schema.test.ts — BUILD §4.3, issue #36
//
// The `sites.setup_*` columns and `apply_setup_choice`, asserted against the
// applied schema. Issue #78 asked for these as a live-schema suite; #6 owns
// `vitest.config.ts` and adds the `LIVE_SCHEMA_TESTS` row that makes them
// run. The facts that used to be read out of the migration text in
// `apply.test.ts` — that the function exists, that it is one PL/pgSQL
// statement, that the deferred destination is written with an existing
// `health` value rather than a fourth one — are asserted here by calling
// it; `apply.test.ts` keeps the module's own behaviour, over its fake db.
//
// **Run this file with `--no-file-parallelism`** alongside the rest of the
// `db` project — every file in it resets and rebuilds the same physical
// `public` schema.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  psql,
  psqlRows,
} from "../../db/substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const APPLIED = ["00000000000001_baseline.sql", "20260906130000_sites_setup.sql"];

/** One tuple-only row per line, `|`-separated columns — easy to split. */
/** Runs `sql` and returns whether it raised (never throws itself). */
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

let USER_ID = "";
let siteCounter = 0;

function makeSite(): string {
  siteCounter += 1;
  const [site] = psqlRows(
    `insert into sites (user_id, domain) values ('${USER_ID}', 'setup-${siteCounter}.example.com') returning id;`
  );
  const id = site?.[0];
  if (!id) throw new Error("site insert returned no id");
  return id;
}

function columnOf(column: string): string[] {
  const [row] = psqlRows(
    `select data_type, is_nullable, coalesce(column_default, 'no default') from information_schema.columns ` +
      `where table_schema = 'public' and table_name = 'sites' and column_name = '${column}';`
  );
  return row ?? [];
}

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  const [user] = psqlRows(
    `insert into users (email, plan_status) values ('setup@example.com', 'active') returning id;`
  );
  USER_ID = user?.[0] ?? "";
  if (!USER_ID) throw new Error("fixture user insert returned no id");
});

afterAll(() => {
  resetSchema();
});

describe("§4.3 — setup's own columns on `sites`", () => {
  it("the two moments and the stage are nullable, because a site in setup has reached neither", () => {
    expect(columnOf("setup_completed_at")).toEqual(["timestamp with time zone", "YES", "no default"]);
    expect(columnOf("setup_released_at")).toEqual(["timestamp with time zone", "YES", "no default"]);
    expect(columnOf("setup_stage")).toEqual(["text", "YES", "no default"]);
  });

  it("the release reason is closed to the four ways setup ends", () => {
    const site = makeSite();
    for (const reason of ["completed", "degraded", "failed", "deadline"]) {
      expect(
        raises(`update sites set setup_released_at = now(), setup_released_reason = '${reason}' where id = '${site}';`),
        reason
      ).toBe(false);
    }
    expect(
      raises(`update sites set setup_released_at = now(), setup_released_reason = 'abandoned' where id = '${site}';`)
    ).toBe(true);
  });

  it("a release is whole — a moment without a reason, or a reason without a moment, is unrepresentable", () => {
    const site = makeSite();
    expect(raises(`update sites set setup_released_at = now() where id = '${site}';`)).toBe(true);
    expect(raises(`update sites set setup_released_reason = 'completed' where id = '${site}';`)).toBe(true);
    expect(
      raises(`update sites set setup_released_at = now(), setup_released_reason = 'completed' where id = '${site}';`)
    ).toBe(false);
  });

  it("the reminder count starts at zero and is capped at three", () => {
    expect(columnOf("setup_reminders_sent")).toEqual(["integer", "NO", "0"]);
    const site = makeSite();
    expect(psqlRows(`select setup_reminders_sent from sites where id = '${site}';`)).toEqual([["0"]]);
    expect(raises(`update sites set setup_reminders_sent = 3 where id = '${site}';`)).toBe(false);
    expect(raises(`update sites set setup_reminders_sent = 4 where id = '${site}';`)).toBe(true);
    expect(raises(`update sites set setup_reminders_sent = -1 where id = '${site}';`)).toBe(true);
  });

  it("the incomplete-setup index is partial, so the sweep reads only sites still in setup", () => {
    const [row] = psqlRows(
      `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_sites_setup_incomplete';`
    );
    expect(row?.[0]).toMatch(
      /CREATE INDEX idx_sites_setup_incomplete ON public\.sites USING btree \(created_at\) WHERE \(setup_completed_at IS NULL\)/
    );
  });
});

describe("§4.3 — the mode and the destination are two writes in one transaction", () => {
  it("the transaction is the database's: one PL/pgSQL function, not a sequence of PostgREST requests", () => {
    const [row] = psqlRows(
      `select l.lanname, pg_get_function_arguments(p.oid) from pg_proc p ` +
        `join pg_namespace n on n.oid = p.pronamespace join pg_language l on l.oid = p.prolang ` +
        `where n.nspname = 'public' and p.proname = 'apply_setup_choice';`
    );
    expect(row).toEqual(["plpgsql", "p_site_id uuid, p_mode text, p_kind text"]);
  });

  it("both writes land, from one call", () => {
    const site = makeSite();
    const [returned] = psqlRows(`select apply_setup_choice('${site}'::uuid, 'autopilot', 'hosted');`);
    expect(psqlRows(`select mode from sites where id = '${site}';`)).toEqual([["autopilot"]]);
    expect(psqlRows(`select site_id, kind from destinations where id = '${returned?.[0]}';`)).toEqual([
      [site, "hosted"],
    ]);
  });

  it("a site that does not exist is an error, never a half-applied setup", () => {
    const before = psqlRows(`select count(*) from destinations;`);
    expect(
      raises(`select apply_setup_choice('00000000-0000-4000-8000-000000000000'::uuid, 'autopilot', 'hosted');`)
    ).toBe(true);
    expect(psqlRows(`select count(*) from destinations;`)).toEqual(before);
  });
});

describe("REQ-028 c3 — a founder who uses WordPress can defer connecting it and setup still completes", () => {
  it("the destination row is created deferred, with no credential collected", () => {
    const site = makeSite();
    const [returned] = psqlRows(`select apply_setup_choice('${site}'::uuid, 'autopilot', 'wordpress');`);
    expect(
      psqlRows(
        `select kind, coalesce(config::text, 'null'), health from destinations where id = '${returned?.[0]}';`
      )
    ).toEqual([["wordpress", "null", "expired"]]);
  });

  it("a deferred connection is an ordinary broken destination, not a fourth state", () => {
    // `expired` is one of the three values the baseline already closed
    // `health` to; setup adds no fourth.
    const site = makeSite();
    expect(raises(`insert into destinations (site_id, kind, health) values ('${site}', 'hosted', 'deferred');`)).toBe(
      true
    );
    for (const health of ["ok", "expired", "error"]) {
      expect(
        raises(`insert into destinations (site_id, kind, health) values ('${site}', 'hosted', '${health}');`),
        health
      ).toBe(false);
    }
  });
});

describe("REQ-028 c5 — nothing is published to any other destination", () => {
  it("the kind written is the kind chosen, for both kinds, and no third is admitted", () => {
    for (const kind of ["hosted", "wordpress"]) {
      const site = makeSite();
      const [returned] = psqlRows(`select apply_setup_choice('${site}'::uuid, 'autopilot', '${kind}');`);
      expect(psqlRows(`select kind from destinations where id = '${returned?.[0]}';`)).toEqual([[kind]]);
    }
    const site = makeSite();
    expect(raises(`select apply_setup_choice('${site}'::uuid, 'autopilot', 'ghost');`)).toBe(true);
  });
});
