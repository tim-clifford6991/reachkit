// The panel's stored evidence and a pass snapshot's reads, loaded into a migrated substrate as the two runners
// load them: triggers off, so each row takes the activity and outcome the attribution trigger would have given it.
//
// A `db`-project suite (`scripts/live-schema-tests.mjs`), run against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertRows } from "../../scripts/local-run.mjs";
import { DATABASE_URL, psql, psqlRows } from "../db/substrate";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS = path.join(ROOT, "supabase/migrations");
const SCAN = "00000000-0000-4000-8000-0000000e71de";

type Row = Record<string, unknown>;
const rowsOf = (file: string): Row[] => JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) as Row[];

/** Every loaded row is there, each a test's call with one of the three outcomes. */
function expectTestCalls(count: number): void {
  const counts = psqlRows("select activity, outcome, count(*) from fetches group by 1, 2;");
  expect(counts.reduce((sum, [, , n]) => sum + Number(n), 0)).toBe(count);
  expect(counts.every(([activity, outcome]) => activity === "test" && ["ok", "failed", "timeout"].includes(outcome!))).toBe(true);
}

beforeAll(() => {
  process.env.DATABASE_URL = DATABASE_URL;
  psql(["-v", "ON_ERROR_STOP=1", "-c", "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;"]);
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    psql(["-v", "ON_ERROR_STOP=1", "-q", "-f", path.join(MIGRATIONS, file)]);
  }
});

beforeEach(() => {
  psql(["-v", "ON_ERROR_STOP=1", "-c", "truncate fetches cascade;"]);
});

describe("insertRows into fetches", () => {
  it("loads the panel's stored evidence, each row a test's call with the outcome its payload says", () => {
    const rows = ["zunicafe.com", "streaksapp.com"].flatMap((domain) => rowsOf(`scripts/panel/evidence/${domain}.json`));
    expect(rows.every((row) => !("activity" in row) && !("outcome" in row))).toBe(true);

    insertRows("fetches", rows.map((row) => ({ ...row, scan_id: SCAN })));

    expectTestCalls(rows.length);
  });

  it("loads a pass snapshot's reads the same way", () => {
    const { fetches } = JSON.parse(readFileSync(path.join(ROOT, "scripts/pass/snapshot/17f5bbff.json"), "utf8")) as { fetches: Row[] };

    insertRows("fetches", fetches);

    expectTestCalls(fetches.length);
  });

  it("keeps an activity or outcome the row holds, and reads a failure from the payload as the trigger does", () => {
    const row = { scan_id: SCAN, source: "serp/google/organic", cost_cents: 0, reserved_cents: 0, policy_version: 1 };
    insertRows("fetches", [
      { ...row, cache_key: "held", payload: { vendorFailure: "timeout" }, activity: "weekly", outcome: "failed" },
      { ...row, cache_key: "timed out", payload: { vendorFailure: "timeout" } },
      { ...row, cache_key: "refused", payload: { refusal: "cap" } },
    ]);

    expect(psqlRows("select cache_key, activity, outcome from fetches order by cache_key;")).toEqual([
      ["held", "weekly", "failed"],
      ["refused", "test", "failed"],
      ["timed out", "test", "timeout"],
    ]);
  });
});
