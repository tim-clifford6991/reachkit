// tests/publish/attempt/schema.test.ts — the unique index that is the
// at-most-once guarantee, and the columns the attempt writes.
//
// ADR-080: "The `publications` row (written before the destination call)
// plus the destination-side marker are the at-most-once guarantee; neither
// may be tidied away." Every assertion below is against the migration text,
// on the same footing as `tests/db/domainblocks.test.ts` — the live-schema
// promotion is issue #78's mechanism (`LIVE_SCHEMA_TESTS` in
// `vitest.config.ts`, an owner file) and is named in this PR's "Owner
// owes". What a text assertion can and cannot see is stated per assertion.
//
// The archived plan is WO-208.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const PUBLICATIONS = readFileSync(
  path.join(MIGRATIONS, "20260906120000_publications_core.sql"),
  "utf8"
);
const DRAFTS = readFileSync(
  path.join(MIGRATIONS, "20260906120100_drafts_publishing.sql"),
  "utf8"
);
const SITES = readFileSync(path.join(MIGRATIONS, "20260906120200_sites_publishing.sql"), "utf8");

/** Comments carry the reasoning and quote the very strings these assertions
 *  look for, so every check runs against the SQL alone. */
function statements(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("§9's idempotency key is a unique index, not a code path", () => {
  const sql = statements(PUBLICATIONS);

  it("the unique index is on exactly (draft_id, destination)", () => {
    expect(sql).toMatch(
      /create unique index idx_publications_one_per_draft_destination\s+on publications \(draft_id, destination\);/
    );
  });

  it("it is unique — a plain index would let a second post exist", () => {
    const line = sql.match(/create[^;]*idx_publications_one_per_draft_destination[^;]*;/)?.[0] ?? "";
    expect(line).toContain("create unique index");
  });

  it("no constraint in this migration carries ON DELETE CASCADE", () => {
    expect(sql.toLowerCase()).not.toContain("on delete cascade");
  });

  it("no migration in the repository adds a cascade into publications", () => {
    for (const name of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
      const body = statements(readFileSync(path.join(MIGRATIONS, name), "utf8")).toLowerCase();
      if (!body.includes("publications")) continue;
      const cascades = body.split("on delete cascade").length - 1;
      expect(cascades, name).toBe(0);
    }
  });
});

describe("the attempt's own columns", () => {
  const sql = statements(PUBLICATIONS);

  it("delivery_state is a closed three-value enum", () => {
    expect(sql).toContain("add column delivery_state text not null default 'claimed'");
    expect(sql).toMatch(/check \(delivery_state in \('claimed', 'delivered', 'failed'\)\)/);
  });

  it("attempt_no counts the attempts and starts at zero", () => {
    expect(sql).toContain("add column attempt_no integer not null default 0");
  });

  it("claimed_at is not null — a row exists only because an attempt was claimed", () => {
    expect(sql).toContain("add column claimed_at timestamptz not null");
  });

  it("failure_reason and remote_id are nullable", () => {
    expect(sql).toContain("add column failure_reason text null");
    expect(sql).toContain("add column remote_id text null");
  });

  it("verify_due_at accepts null — a delivery with no address is due for no check", () => {
    expect(sql).toContain("add column verify_due_at timestamptz null");
  });
});

describe("ADR-084 Decision 4 — made_live_by_us exists and defaults to false", () => {
  const sql = statements(PUBLICATIONS);

  it("it is boolean not null default false", () => {
    expect(sql).toContain("add column made_live_by_us boolean not null default false");
  });

  it("nothing constrains it to one value — the false arm is the one no production path writes today", () => {
    expect(sql).not.toMatch(/check \([^)]*made_live_by_us[^)]*\)/);
  });
});

describe("ADR-082 Decision 6 — unpublish_outcome records which of five things happened", () => {
  const sql = statements(PUBLICATIONS);

  it.each([
    "removed",
    "returned_to_draft",
    "named_for_removal",
    "already_gone",
    "unreachable",
  ])("the constraint permits %s", (outcome) => {
    const check = sql.match(/check \(unpublish_outcome in \(([^)]*)\)\)/s)?.[1] ?? "";
    expect(check).toContain(`'${outcome}'`);
  });

  it("it permits exactly five and no sixth", () => {
    const check = sql.match(/check \(unpublish_outcome in \(([^)]*)\)\)/s)?.[1] ?? "";
    expect(check.split(",").filter((s) => s.trim().length > 0)).toHaveLength(5);
  });

  it("named_for_removal is present, and it is the arm a narrowed constraint would quietly drop", () => {
    // No production adapter can return it since 2026-09-01, so nothing else
    // in the suite would notice its absence.
    expect(sql).toContain("'named_for_removal'");
  });
});

describe("the indexes the two ceilings and the 24-hour check read", () => {
  const sql = statements(PUBLICATIONS);

  it("(site_id, published_at) — the two ceiling counts are one range scan", () => {
    expect(sql).toContain("create index idx_publications_site_published on publications (site_id, published_at)");
  });

  it("(verify_due_at) where verify is null — the due-work scan", () => {
    expect(sql).toMatch(/create index idx_publications_verify_due on publications \(verify_due_at\)\s+where verify is null;/);
  });
});

describe("the drafts columns the state machine needs", () => {
  const sql = statements(DRAFTS);

  it("transitions is an append-only array with an empty default", () => {
    expect(sql).toContain("add column transitions jsonb not null default '[]'::jsonb");
  });

  it("publishable_since is nullable — a page that never became publishable has no moment", () => {
    expect(sql).toContain("add column publishable_since timestamptz null");
  });

  it("hard_rules_passed defaults to false — a draft that recorded nothing has passed nothing", () => {
    expect(sql).toContain("add column hard_rules_passed boolean not null default false");
  });

  it("there is no column named held — a held page is the absence of an edge", () => {
    expect(sql).not.toMatch(/add column\s+held/);
  });
});

describe("publish_transition writes the state and the record in one statement", () => {
  const sql = statements(DRAFTS);

  it("one update, and the record is appended in it", () => {
    const body = sql.slice(sql.indexOf("create or replace function publish_transition"));
    expect(body.match(/update drafts/g) ?? []).toHaveLength(1);
    expect(body).toContain("transitions = coalesce(transitions, '[]'::jsonb) || jsonb_build_array(p_record)");
  });

  it("the update is guarded by the state it was checked against — the optimistic lock", () => {
    const body = sql.slice(sql.indexOf("create or replace function publish_transition"));
    expect(body).toContain("where id = p_draft_id and state = p_from");
  });

  it("it reports whether exactly one row moved, so a loser is told it lost", () => {
    const body = sql.slice(sql.indexOf("create or replace function publish_transition"));
    expect(body).toContain("get diagnostics moved = row_count");
    expect(body).toContain("return moved = 1");
  });
});

describe("the publishing switch", () => {
  const sql = statements(SITES);

  it("defaults to true — a site that never opened Settings is publishing", () => {
    expect(sql).toContain("add column publishing_enabled boolean not null default true");
  });

  it("records the moment §9's promise is stated against", () => {
    expect(sql).toContain("add column publishing_changed_at timestamptz null");
  });
});
