// tests/publish/attempt/schema.test.ts — the unique index that is the
// at-most-once guarantee, and the columns the attempt writes.
//
// ADR-080: "The `publications` row (written before the destination call)
// plus the destination-side marker are the at-most-once guarantee; neither
// may be tidied away."
//
// **Promoted to a live-schema suite (issue #78, via #6).** Every assertion
// here used to be against the migration text, because `LIVE_SCHEMA_TESTS`
// (`vitest.config.ts`) was an owner file a feature PR could not add a row
// to. Issue #6 owns that file: the baseline plus `*_publications_core*`,
// `*_drafts_publishing*` and `*_sites_publishing*` are applied to the
// scratch database, and the second post is refused by Postgres rather than
// by a regular expression.
//
// The archived plan is WO-208.
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
const APPLIED = [
  "00000000000001_baseline.sql",
  "20260906120000_publications_core.sql",
  "20260906120100_drafts_publishing.sql",
  "20260906120200_sites_publishing.sql",
  // REQ-060 c4's column (issue #156). Same topic, later file.
  "20260907120000_publications_seo.sql",
];

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

let SITE_ID = "";
let SCAN_ID = "";

beforeAll(() => {
  resetSchema();
  for (const file of APPLIED) psql(["-v", "ON_ERROR_STOP=1", "-f", path.join(MIGRATIONS, file)]);
  const [user] = psqlRows(
    `insert into users (email, plan_status) values ('attempt@example.com', 'active') returning id;`
  );
  const [site] = psqlRows(
    `insert into sites (user_id, domain) values ('${user?.[0]}', 'attempt.example.com') returning id;`
  );
  const [scan] = psqlRows(
    `insert into scans (site_id, domain, tier, status) values ('${site?.[0]}', 'attempt.example.com', 'deep', 'done') returning id;`
  );
  SITE_ID = site?.[0] ?? "";
  SCAN_ID = scan?.[0] ?? "";
  if (!SITE_ID || !SCAN_ID) throw new Error("fixture rows returned no id");
});

afterAll(() => {
  resetSchema();
});

let draftCounter = 0;

/** A draft on the fixture site, through its own opportunity. */
function insertDraft(state = "approved"): string {
  draftCounter += 1;
  const [opportunity] = psqlRows(
    `insert into opportunities (site_id, scan_id, type, family, target_query, proposed_slug, title) values (` +
      `'${SITE_ID}', '${SCAN_ID}', 'answer_page', 'write', 'q ${draftCounter}', 'slug-${draftCounter}', 'T ${draftCounter}') returning id;`
  );
  const [draft] = psqlRows(
    `insert into drafts (opportunity_id, site_id, state, title) values ('${opportunity?.[0]}', '${SITE_ID}', '${state}', 'T ${draftCounter}') returning id;`
  );
  const id = draft?.[0];
  if (!id) throw new Error("draft insert returned no id");
  return id;
}

/** Claims a publication, returning whether the database refused it. */
function claim(draftId: string, destination: string, columns: Record<string, string> = {}): boolean {
  const names = ["draft_id", "site_id", "destination", "mode", ...Object.keys(columns)];
  const values = [`'${draftId}'`, `'${SITE_ID}'`, `'${destination}'`, "'autopilot'", ...Object.values(columns)];
  return raises(`insert into publications (${names.join(", ")}) values (${values.join(", ")});`);
}

function columnOf(table: string, column: string): string[] {
  const [row] = psqlRows(
    `select data_type, is_nullable, coalesce(column_default, 'no default') from information_schema.columns ` +
      `where table_schema = 'public' and table_name = '${table}' and column_name = '${column}';`
  );
  return row ?? [];
}

describe("§9's idempotency key is a unique index, not a code path", () => {
  it("the unique index is on exactly (draft_id, destination)", () => {
    const [row] = psqlRows(
      `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_publications_one_per_draft_destination';`
    );
    expect(row?.[0]).toMatch(
      /CREATE UNIQUE INDEX idx_publications_one_per_draft_destination ON public\.publications USING btree \(draft_id, destination\)/
    );
  });

  it("a second post to the same destination is unrepresentable — a plain index would let it exist", () => {
    const draft = insertDraft();
    expect(claim(draft, "hosted")).toBe(false);
    expect(claim(draft, "hosted")).toBe(true);
    // Another destination for the same page is a different attempt.
    expect(claim(draft, "wordpress")).toBe(false);
  });

  it("no foreign key into or out of `publications` carries ON DELETE CASCADE", () => {
    // `confdeltype` is 'a' for NO ACTION, 'c' for CASCADE. A cascade either
    // way would let the at-most-once record be tidied away.
    const cascading = psqlRows(
      `select conname from pg_constraint where contype = 'f' and confdeltype <> 'a' ` +
        `and (conrelid = 'public.publications'::regclass or confrelid = 'public.publications'::regclass);`
    );
    expect(cascading).toEqual([]);
  });
});

describe("the attempt's own columns", () => {
  it("delivery_state is a closed three-value enum", () => {
    expect(columnOf("publications", "delivery_state")).toEqual(["text", "NO", "'claimed'::text"]);
    const draft = insertDraft();
    for (const state of ["claimed", "delivered", "failed"]) {
      expect(claim(draft, `dest-${state}`, { delivery_state: `'${state}'` }), state).toBe(false);
    }
    expect(claim(draft, "dest-bogus", { delivery_state: "'queued'" })).toBe(true);
  });

  it("attempt_no counts the attempts and starts at zero", () => {
    expect(columnOf("publications", "attempt_no")).toEqual(["integer", "NO", "0"]);
  });

  it("claimed_at is not null — a row exists only because an attempt was claimed", () => {
    expect(columnOf("publications", "claimed_at").slice(0, 2)).toEqual(["timestamp with time zone", "NO"]);
    const draft = insertDraft();
    expect(claim(draft, "dest-null-claimed-at", { claimed_at: "null" })).toBe(true);
  });

  it("failure_reason and remote_id are nullable", () => {
    expect(columnOf("publications", "failure_reason")).toEqual(["text", "YES", "no default"]);
    expect(columnOf("publications", "remote_id")).toEqual(["text", "YES", "no default"]);
  });

  it("verify_due_at accepts null — a delivery with no address is due for no check", () => {
    expect(columnOf("publications", "verify_due_at")).toEqual([
      "timestamp with time zone",
      "YES",
      "no default",
    ]);
  });
});

describe("ADR-084 Decision 4 — made_live_by_us exists and defaults to false", () => {
  it("it is boolean not null default false", () => {
    expect(columnOf("publications", "made_live_by_us")).toEqual(["boolean", "NO", "false"]);
  });

  it("nothing constrains it to one value — the false arm is the one no production path writes today", () => {
    const draft = insertDraft();
    expect(claim(draft, "dest-live-true", { made_live_by_us: "true" })).toBe(false);
    expect(claim(draft, "dest-live-false", { made_live_by_us: "false" })).toBe(false);
  });
});

describe("REQ-060 c4 — seo_written is three-valued in the database (issue #156)", () => {
  it("it is a text array, nullable, and has no default", () => {
    // The default is the whole assertion. `not null default '{}'` would
    // make every row that was never delivered — and every hosted row —
    // indistinguishable from a delivery that found no SEO plugin, which
    // puts criterion 4's line on pages it must never appear on.
    expect(columnOf("publications", "seo_written")).toEqual(["ARRAY", "YES", "no default"]);
  });

  it("null, the empty array and a populated array are three storable values", () => {
    const draft = insertDraft();
    expect(claim(draft, "dest-seo-null", { seo_written: "null" })).toBe(false);
    expect(claim(draft, "dest-seo-empty", { seo_written: "'{}'" })).toBe(false);
    expect(claim(draft, "dest-seo-one", { seo_written: "'{yoast}'" })).toBe(false);
  });

  it("they read back as three distinct values, and the empty array is not null", () => {
    const draft = insertDraft();
    claim(draft, "dest-seo-read-null", { seo_written: "null" });
    claim(draft, "dest-seo-read-empty", { seo_written: "'{}'" });
    claim(draft, "dest-seo-read-one", { seo_written: "'{yoast,rankmath}'" });
    const rows = psqlRows(
      `select destination, coalesce(seo_written::text, 'NULL'), coalesce(array_length(seo_written, 1)::text, 'none') ` +
        `from publications where destination like 'dest-seo-read-%' order by destination;`
    );
    expect(rows).toEqual([
      ["dest-seo-read-empty", "{}", "none"],
      ["dest-seo-read-null", "NULL", "none"],
      ["dest-seo-read-one", "{yoast,rankmath}", "2"],
    ]);
  });

  it("no constraint names the plugins — the closed list lives in the adapter, not in the schema", () => {
    const draft = insertDraft();
    expect(claim(draft, "dest-seo-unknown", { seo_written: "'{some_other_plugin}'" })).toBe(false);
  });
});

describe("ADR-082 Decision 6 — unpublish_outcome records which of five things happened", () => {
  it.each(["removed", "returned_to_draft", "named_for_removal", "already_gone", "unreachable"])(
    "the constraint permits %s",
    (outcome) => {
      const draft = insertDraft();
      expect(claim(draft, `dest-${outcome}`, { unpublish_outcome: `'${outcome}'` })).toBe(false);
    }
  );

  it("it permits exactly five and no sixth", () => {
    const [row] = psqlRows(
      `select (select count(*) from regexp_matches(pg_get_constraintdef(oid), '''[a-z_]+''', 'g')) ` +
        `from pg_constraint where conrelid = 'public.publications'::regclass ` +
        `and pg_get_constraintdef(oid) like '%unpublish_outcome%';`
    );
    expect(row).toEqual(["5"]);
    const draft = insertDraft();
    expect(claim(draft, "dest-sixth", { unpublish_outcome: "'tidied'" })).toBe(true);
  });

  it("named_for_removal is present, and it is the arm a narrowed constraint would quietly drop", () => {
    // No production adapter can return it since 2026-09-01, so nothing else
    // in the suite would notice its absence.
    const draft = insertDraft();
    expect(claim(draft, "dest-named", { unpublish_outcome: "'named_for_removal'" })).toBe(false);
  });
});

describe("the indexes the two ceilings and the 24-hour check read", () => {
  it("(site_id, published_at) — the two ceiling counts are one range scan", () => {
    const [row] = psqlRows(
      `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_publications_site_published';`
    );
    expect(row?.[0]).toMatch(
      /CREATE INDEX idx_publications_site_published ON public\.publications USING btree \(site_id, published_at\)/
    );
  });

  it("(verify_due_at) where verify is null — the due-work scan", () => {
    const [row] = psqlRows(
      `select indexdef from pg_indexes where schemaname = 'public' and indexname = 'idx_publications_verify_due';`
    );
    expect(row?.[0]).toMatch(
      /CREATE INDEX idx_publications_verify_due ON public\.publications USING btree \(verify_due_at\) WHERE \(verify IS NULL\)/
    );
  });
});

describe("the drafts columns the state machine needs", () => {
  it("transitions is an append-only array with an empty default", () => {
    expect(columnOf("drafts", "transitions")).toEqual(["jsonb", "NO", "'[]'::jsonb"]);
  });

  it("publishable_since is nullable — a page that never became publishable has no moment", () => {
    expect(columnOf("drafts", "publishable_since")).toEqual([
      "timestamp with time zone",
      "YES",
      "no default",
    ]);
  });

  it("hard_rules_passed defaults to false — a draft that recorded nothing has passed nothing", () => {
    expect(columnOf("drafts", "hard_rules_passed")).toEqual(["boolean", "NO", "false"]);
  });

  it("there is no column named held — a held page is the absence of an edge", () => {
    expect(columnOf("drafts", "held")).toEqual([]);
  });
});

describe("publish_transition writes the state and the record in one statement", () => {
  it("one update, and the record is appended in it", () => {
    const draft = insertDraft("in_review");
    expect(
      psqlRows(`select publish_transition('${draft}'::uuid, 'in_review', 'approved', '{"at":"one"}'::jsonb);`)
    ).toEqual([["t"]]);
    expect(psqlRows(`select state, jsonb_array_length(transitions) from drafts where id = '${draft}';`)).toEqual([
      ["approved", "1"],
    ]);
    psql([
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `select publish_transition('${draft}'::uuid, 'approved', 'publishing', '{"at":"two"}'::jsonb);`,
    ]);
    expect(
      psqlRows(`select jsonb_array_length(transitions), transitions -> 1 ->> 'at' from drafts where id = '${draft}';`)
    ).toEqual([["2", "two"]]);
  });

  it("the update is guarded by the state it was checked against — the optimistic lock", () => {
    const draft = insertDraft("in_review");
    expect(
      psqlRows(`select publish_transition('${draft}'::uuid, 'approved', 'publishing', '{"at":"lost"}'::jsonb);`)
    ).toEqual([["f"]]);
    expect(psqlRows(`select state, jsonb_array_length(transitions) from drafts where id = '${draft}';`)).toEqual([
      ["in_review", "0"],
    ]);
  });

  it("it reports whether exactly one row moved, so a loser is told it lost", () => {
    const draft = insertDraft("in_review");
    expect(
      psqlRows(`select publish_transition('${draft}'::uuid, 'in_review', 'approved', '{"at":"winner"}'::jsonb);`)
    ).toEqual([["t"]]);
    // The second caller checked the same `from` and lost the race.
    expect(
      psqlRows(`select publish_transition('${draft}'::uuid, 'in_review', 'skipped', '{"at":"loser"}'::jsonb);`)
    ).toEqual([["f"]]);
    expect(psqlRows(`select state from drafts where id = '${draft}';`)).toEqual([["approved"]]);
  });
});

describe("the publishing switch", () => {
  it("defaults to true — a site that never opened Settings is publishing", () => {
    expect(columnOf("sites", "publishing_enabled")).toEqual(["boolean", "NO", "true"]);
  });

  it("records the moment §9's promise is stated against", () => {
    expect(columnOf("sites", "publishing_changed_at")).toEqual([
      "timestamp with time zone",
      "YES",
      "no default",
    ]);
  });
});
