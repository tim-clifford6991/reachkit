// The daily check's runway query against a live schema: one row per set-up site, and every empty day in
// the last 7 in a class the stored reason and the day's open rows decide, an unknown reason named.
//
// A `db`-project suite (`scripts/live-schema-tests.mjs`), run against `scripts/db-substrate/` in CI's `schema · RLS` gate.
import { readdirSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RUNWAY_SQL } from "../../scripts/daily-check/runway.mjs";
import { psql, psqlRows } from "./substrate";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");

function run(sql: string): void {
  psql(["-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function resetSchema(): void {
  run("drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;");
}

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

function site(n: number, domain: string, a: { setUp?: boolean; deleted?: boolean } = {}): void {
  run(`insert into users (id, email, plan_status, deleted_at) values ('${id(n)}', 'o@${domain}', 'active', ${a.deleted ? "now()" : "null"});
    insert into sites (id, user_id, domain, setup_completed_at) values ('${id(n)}', '${id(n)}', '${domain}', ${a.setUp === false ? "null" : "now()"});
    insert into scans (id, site_id, domain, tier, status) values ('${id(n)}', '${id(n)}', '${domain}', 'deep', 'done');`);
}

/** A new-page topic, `created` days ago. */
function topic(n: number, siteN: number, a: { status?: string; unready?: string; created?: number } = {}): void {
  const reason = a.unready === undefined ? "null" : `'${a.unready}'`;
  run(`insert into opportunities (id, site_id, scan_id, type, family, target_query, target_ref, proposed_slug, title, fit_band, effort, evidence, acceptance, status, ready, unready_reason, created_at)
    values ('${id(n)}', '${id(siteN)}', '${id(siteN)}', 'answer_page', 'write', 'q${n}', 'q${n}', 'q${n}', 'Q${n}', 'winnable', 0.5, '{"family":"write"}', '{}',
      '${a.status ?? "open"}', ${a.unready === undefined}, ${reason}, now() - interval '${a.created ?? 30} days');`);
}

/** How the due hour `ago` days back ended. */
function day(siteN: number, ago: number, outcome: string, reason: string | null): void {
  run(`insert into draft_days (site_id, publish_date, outcome, reason, decided_at)
    values ('${id(siteN)}', current_date - ${ago}, '${outcome}', ${reason === null ? "null" : `'${reason}'`}, (current_date - ${ago}) + time '18:00');`);
}

beforeAll(() => {
  resetSchema();
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    psql(["-v", "ON_ERROR_STOP=1", "-q", "-f", path.join(MIGRATIONS, file)]);
  }
  site(1, "a.example");
  topic(11, 1);
  topic(12, 1);
  topic(13, 1, { status: "queued" });
  run(`insert into drafts (id, opportunity_id, site_id, state, scheduled_for) values
      ('${id(21)}', '${id(12)}', '${id(1)}', 'in_review', current_date + 1),
      ('${id(22)}', '${id(13)}', '${id(1)}', 'skipped', current_date + 2),
      ('${id(23)}', '${id(13)}', '${id(1)}', 'needs_attention', current_date + 3);
    insert into publications (draft_id, site_id, destination, mode, published_at) values ('${id(21)}', '${id(1)}', 'hosted', 'autopilot', now() - interval '3 days');
    insert into ops_events (at, kind, read, site_id, code) values
      (now() - interval '2 days', 'supply_short', 'asked', '${id(1)}', '4'),
      (now() - interval '1 day', 'supply_short', 'product,asked', '${id(1)}', '6');`);
  day(1, 0, "no_page", "generate:rules");
  day(1, 1, "no_page", "generate:step_failed:write");
  day(1, 2, "no_page", "generate:budget");
  day(1, 3, "no_page", "generate:unknown_new");
  day(1, 4, "no_page", "generate:no_opportunity");
  day(1, 5, "drafted", null);
  day(1, 6, "failed", "TypeError");
  day(1, 7, "no_page", "generate:rules");

  site(2, "b.example");
  topic(31, 2, { unready: "no_grounding_fact", created: 3 });
  topic(32, 2, { unready: "no_grounding_fact", created: 3 });
  day(2, 0, "no_page", "generate:no_opportunity");
  day(2, 5, "no_page", "generate:no_opportunity");

  // Open rows, none ready and uncommitted: one resting, one ready but already drafted.
  site(5, "c.example");
  topic(41, 5, { unready: "resting" });
  topic(42, 5);
  run(`insert into drafts (id, opportunity_id, site_id, state, scheduled_for) values ('${id(43)}', '${id(42)}', '${id(5)}', 'in_review', current_date);`);
  day(5, 1, "no_page", "generate:no_opportunity");

  site(3, "not-set-up.example", { setUp: false });
  site(4, "deleted.example", { deleted: true });
});

afterAll(() => {
  resetSchema();
});

describe("the runway query", () => {
  it("answers one row per set-up site of a live account, with what is left and each empty day's class", () => {
    const rows = psqlRows(RUNWAY_SQL).map(([, domain, ready, ahead, live, empty, shortAt, dry]) => ({
      domain,
      ready,
      ahead,
      live,
      empty: JSON.parse(empty ?? "null"),
      shortAt: shortAt === "" ? null : shortAt?.slice(0, 10),
      dry,
    }));
    const yesterday = psqlRows("select (now() - interval '1 day')::date;")[0]?.[0];
    expect(rows).toEqual([
      {
        domain: "a.example",
        ready: "1",
        ahead: "1",
        live: "3",
        empty: {
          rules: 1,
          step_failed: 1,
          budget: 1,
          "other: generate:unknown_new": 1,
          no_opportunity_ready_rows: 1,
          "other: failed:TypeError": 1,
        },
        shortAt: yesterday,
        dry: "product,asked",
      },
      // The rows were stamped ungrounded after the older day, so that day found none open.
      { domain: "b.example", ready: "0", ahead: "0", live: "", empty: { grounding_failed: 1, no_opportunity_empty: 1 }, shortAt: null, dry: "" },
      // Only a ready row no page was drafted from counts as one the day could have written.
      { domain: "c.example", ready: "0", ahead: "0", live: "", empty: { no_opportunity_none_ready: 1 }, shortAt: null, dry: "" },
    ]);
  });
});
