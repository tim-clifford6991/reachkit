// tests/publish/publishable/schema.test.ts — the columns the veto leaf
// writes, and the two statements it depends on.
//
// Every assertion is against the migration **text**, on the same footing as
// `tests/publish/attempt/schema.test.ts` and `tests/db/domainblocks.test.ts`:
// promoting a suite to the live schema needs a line in `LIVE_SCHEMA_TESTS`
// (`vitest.config.ts`, an owner file), which is named in this PR's "Owner
// owes". What a text assertion can and cannot see is stated per assertion.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { topicOf } from "@/lib/db/topics";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../../supabase/migrations");
const DRAFTS_VETO = "20260906120300_drafts_veto.sql";
const SITES_SETTINGS = "20260906120400_sites_settings.sql";

function statements(name: string): string {
  return readFileSync(path.join(MIGRATIONS, name), "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("the migrations carry their own sub-tokens", () => {
  it("`drafts_veto` is the veto leaf's, not the state machine's", () => {
    expect(topicOf(DRAFTS_VETO)).toEqual({ token: "drafts_veto", owner: "BP-046" });
  });

  it("`sites_settings` is the settings leaf's", () => {
    expect(topicOf(SITES_SETTINGS)).toEqual({ token: "sites_settings", owner: "BP-057" });
  });
});

describe("the approval, the telling and the token are columns on `drafts`", () => {
  const sql = statements(DRAFTS_VETO);

  it.each([
    "approved_at timestamptz null",
    "approved_by jsonb null",
    "told jsonb null",
    "veto_token_hash text null",
    "veto_token_expires_at timestamptz null",
    "veto_token_used_at timestamptz null",
  ])("adds `%s`", (column) => {
    expect(sql).toContain(`add column ${column}`);
  });

  it("the token column holds a hash, and the migration never names a column for the token itself", () => {
    expect(sql).not.toMatch(/add column veto_token\b/);
  });

  it("two drafts cannot share a token", () => {
    expect(sql).toMatch(
      /create unique index idx_drafts_veto_token_hash\s+on drafts \(veto_token_hash\)/
    );
  });
});

describe("the redemption is one statement", () => {
  const sql = statements(DRAFTS_VETO);

  it("it marks the token used in the same statement that reads it, so a double click cannot skip twice", () => {
    const fn = sql.match(/create or replace function redeem_veto_token[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(fn).toContain("update drafts set veto_token_used_at = p_now");
    expect(fn).toContain("veto_token_used_at is null");
  });

  it("it refuses an expired token", () => {
    const fn = sql.match(/create or replace function redeem_veto_token[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(fn).toContain("veto_token_expires_at > p_now");
  });

  it("it moves no page — the `in_review → skipped` move stays `transition()`'s", () => {
    const fn = sql.match(/create or replace function redeem_veto_token[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(fn).not.toContain("state =");
    expect(fn).not.toContain("skipped");
  });

  it("it compares a hash the caller computed, so no token reaches the database", () => {
    expect(sql).toContain("p_token_hash text");
  });
});

describe("the settings save is one statement", () => {
  const sql = statements(SITES_SETTINGS);

  it("it writes the four values and the drafts' deadlines in one function", () => {
    expect(sql).toContain("update sites set");
    expect(sql).toContain("update drafts set");
    for (const column of ["mode = p_mode", "veto_hours = p_veto_hours", "publish_time = p_publish_time", "timezone = p_timezone"]) {
      expect(sql).toContain(column);
    }
  });

  it("it clears the telling rather than sending one, and only where the caller said to", () => {
    expect(sql).toContain("told = case when rows.clear_told then null else drafts.told end");
  });

  it("it re-implements none of REQ-073 c4's rules — the deadlines arrive computed", () => {
    // The four rules live in `newVetoDeadline`. A second copy in PL/pgSQL
    // is the copy that drifts; the function names no mode and no window.
    expect(sql).not.toContain("copilot");
    expect(sql).not.toContain("autopilot");
    expect(sql).not.toMatch(/interval\s+'\d/);
  });

  it("it adds no column — all four already exist", () => {
    expect(sql).not.toContain("add column");
  });

  it("it never reaches a draft belonging to another site", () => {
    expect(sql).toContain("drafts.site_id = p_site_id");
  });
});
