// tests/db/baseline.test.ts
//
// WO-267 `## Test plan` (carried verbatim from WO-009), asserted against a
// scratch database the baseline migration is actually applied to, per row:
// "Applies the migration to a scratch database and asserts the schema
// below."
//
// **Substrate note (owner ruling, 2026-09-03; Docker unavailable on this
// host):** `supabase db reset` cannot run. In its place this file resets
// and re-applies `00000000000001_baseline.sql` against native PostgreSQL 18
// at `127.0.0.1:5432`, database `reachkit_scratch`
// (`postgresql://reachkit:reachkit@127.0.0.1:5432/reachkit_scratch`), via
// `psql` spawned from `child_process` — the same mechanism `supabase db
// reset` would use under the hood, against the same migration file.
//
// **Run this file, `rls.test.ts` and `clients.test.ts` with
// `--no-file-parallelism`** (or any other setting that keeps Vitest from
// running test files concurrently): all three reset and rebuild the same
// physical `public` schema on the one scratch database `supabase db
// reset` would otherwise give each an isolated instance of. Concurrent
// file execution races on that shared schema and produces spurious
// failures unrelated to this work order — confirmed by running `tests/
// db/` with and without the flag. `vitest.config.ts` is outside this work
// order's file plan (rule 2), so the flag is stated here rather than
// forced in config; `migration-naming.test.ts` touches no live database
// and is unaffected.
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  psql,
  psqlRows,
} from "./substrate";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const BASELINE_MIGRATION = path.join(
  REPO_ROOT,
  "supabase/migrations/00000000000001_baseline.sql"
);

/** One tuple-only row per line, `|`-separated columns — easy to split. */
beforeAll(() => {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
  psql(["-v", "ON_ERROR_STOP=1", "-f", BASELINE_MIGRATION]);
});

afterAll(() => {
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    "drop schema public cascade; create schema public; grant usage on schema public to anon, authenticated, service_role;",
  ]);
});

const EIGHT_TABLES = [
  "users",
  "sites",
  "scans",
  "opportunities",
  "drafts",
  "publications",
  "destinations",
  "leads",
] as const;

describe("`SPEC.md` §10's nine-row table — the baseline creates eight, and `fetches` is absent", () => {
  it("creates exactly the eight table names (not the ninth, `fetches`)", () => {
    const rows = psqlRows(
      `select table_name from information_schema.tables where table_schema = 'public' order by table_name;`
    );
    const names = rows.map((r) => r[0]);
    expect(names.sort()).toEqual([...EIGHT_TABLES].sort());
  });

  it("`fetches` is absent — BP-007 owns `*_fetches*.sql` (WO-267 `rests-on` row 1)", () => {
    const rows = psqlRows(
      `select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fetches';`
    );
    expect(rows).toHaveLength(0);
  });

  // `SPEC.md` §10, quoted per table (key columns only).
  const KEY_COLUMNS: Record<(typeof EIGHT_TABLES)[number], string[]> = {
    users: ["id", "email", "plan_status", "stripe_customer_id", "created_at"],
    sites: [
      "id",
      "user_id",
      "domain",
      "category",
      "competitors",
      "mode",
      "veto_hours",
      "publish_time",
      "voice_text",
      "do_not_claim",
      "created_at",
    ],
    scans: [
      "id",
      "site_id",
      "domain",
      "tier",
      "status",
      "score",
      "drivers",
      "report",
      "cost_cents",
      "created_at",
    ],
    opportunities: [
      "id",
      "site_id",
      "scan_id",
      "type",
      "family",
      "target_query",
      "volume",
      "evidence",
      "proposed_slug",
      "title",
      "effort",
      "fit_band",
      "acceptance",
      "status",
      "created_at",
    ],
    drafts: [
      "id",
      "opportunity_id",
      "site_id",
      "state",
      "title",
      "body_md",
      "meta",
      "grounded_fact",
      "cost_cents",
      "scheduled_for",
      "veto_deadline",
      "created_at",
    ],
    publications: [
      "id",
      "draft_id",
      "site_id",
      "destination",
      "live_url",
      "published_at",
      "mode",
      "verify",
      "unpublished_at",
    ],
    destinations: ["id", "site_id", "kind", "config", "health", "created_at"],
    leads: ["id", "scan_id", "email", "consented_at", "converted_at", "draft_sent_at"],
  };

  it.each(EIGHT_TABLES)("%s carries every key column `SPEC.md` §10 lists", (table) => {
    const rows = psqlRows(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = '${table}';`
    );
    const actual = new Set(rows.map((r) => r[0]));
    for (const column of KEY_COLUMNS[table]) {
      expect(actual.has(column)).toBe(true);
    }
  });
});

describe('BP-002 `## Data model delta` — "`publications` carries no `verdict` column"', () => {
  it("has no `verdict` column", () => {
    const rows = psqlRows(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = 'publications' and column_name = 'verdict';`
    );
    expect(rows).toHaveLength(0);
  });
});

describe('ADR-051 point 2 / BP-002 `## Error & edge behavior` — "No foreign key from `users` or `sites` carries `ON DELETE CASCADE`"', () => {
  it("no foreign key whose referenced table is `users` or `sites` has `delete_rule = CASCADE`", () => {
    const rows = psqlRows(`
      select tc.table_name, tc.constraint_name, ccu.table_name as referenced_table, rc.delete_rule
      from information_schema.table_constraints tc
      join information_schema.referential_constraints rc
        on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.constraint_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = rc.unique_constraint_name and ccu.constraint_schema = rc.constraint_schema
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public';
    `);
    expect(rows.length).toBeGreaterThan(0); // sanity: there are FKs to check
    const toUsersOrSites = rows.filter((r) => r[2] === "users" || r[2] === "sites");
    expect(toUsersOrSites.length).toBeGreaterThan(0);
    for (const [, constraintName, referencedTable, deleteRule] of toUsersOrSites) {
      expect(deleteRule, `${constraintName} (-> ${referencedTable}) must not cascade`).not.toBe(
        "CASCADE"
      );
    }
  });

  it("watch it fail first: adding one cascade to `sites.user_id` is caught", () => {
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "alter table sites drop constraint sites_user_id_fkey, add constraint sites_user_id_fkey foreign key (user_id) references users (id) on delete cascade;",
    ]);
    const rows = psqlRows(`
      select rc.delete_rule
      from information_schema.table_constraints tc
      join information_schema.referential_constraints rc
        on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.constraint_schema
      where tc.table_name = 'sites' and tc.constraint_name = 'sites_user_id_fkey';
    `);
    expect(rows[0]?.[0]).toBe("CASCADE"); // proves the check above would have failed
    // Restore.
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "alter table sites drop constraint sites_user_id_fkey, add constraint sites_user_id_fkey foreign key (user_id) references users (id);",
    ]);
  });
});

describe('BP-002 `## Error & edge behavior` — "a table with no policy is unreadable by anyone holding an anon or authenticated key"', () => {
  it.each(EIGHT_TABLES)("%s has row-level security enabled", (table) => {
    const rows = psqlRows(
      `select relrowsecurity from pg_class where relname = '${table}' and relnamespace = 'public'::regnamespace;`
    );
    expect(rows[0]?.[0]).toBe("t");
  });

  it.each(EIGHT_TABLES)("an anon-role select on %s returns zero rows (no policy yet)", (table) => {
    // Seed one row directly (bypassing RLS as the table owner) so a leak
    // would be observable, then read it back as `anon`.
    seedOneRow();
    const rows = psqlRows(`set role anon; select 1 from ${table}; reset role;`);
    expect(rows).toHaveLength(0);
  });
});

describe('BP-002 `## NFR budget` — "Every query the app makes on a request path is indexed"', () => {
  const EXPECTED_INDEXES = [
    "idx_sites_user_id",
    "idx_scans_site_id",
    "idx_scans_domain",
    "idx_opportunities_site_id",
    "idx_opportunities_scan_id",
    "idx_drafts_opportunity_id",
    "idx_drafts_site_id",
    "idx_publications_draft_id",
    "idx_publications_site_id",
    "idx_destinations_site_id",
    "idx_leads_scan_id",
  ];

  it.each(EXPECTED_INDEXES)("index %s exists", (indexName) => {
    const rows = psqlRows(
      `select 1 from pg_indexes where schemaname = 'public' and indexname = '${indexName}';`
    );
    expect(rows).toHaveLength(1);
  });
});

// Seeds exactly one syntactically-valid row per table, respecting FK order,
// as the (RLS-bypassing) table owner. Reused by the anon-read tests above
// (every table's row is seeded together the first time any of them asks).
let seeded = false;
function seedOneRow(): void {
  if (seeded) return;
  seeded = true;
  psql([
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    `
    insert into users (id, email, plan_status) values
      ('00000000-0000-0000-0000-000000000001', 'seed@example.com', 'active');
    insert into sites (id, user_id, domain) values
      ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'example.com');
    insert into scans (id, site_id, domain, tier, status) values
      ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'example.com', 'free', 'done');
    insert into opportunities (id, site_id, scan_id, type, family, target_query, proposed_slug, title) values
      ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 't', 'f', 'q', 's', 'title');
    insert into drafts (id, opportunity_id, site_id, state, title) values
      ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'drafting', 'title');
    insert into publications (id, draft_id, site_id, destination, mode) values
      ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'hosted', 'autopilot');
    insert into destinations (id, site_id, kind) values
      ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', 'hosted');
    insert into leads (id, scan_id, email) values
      ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000003', 'lead@example.com');
    `,
  ]);
}
