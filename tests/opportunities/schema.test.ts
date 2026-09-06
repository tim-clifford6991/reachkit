// BUILD §7, §10 — the invariants the schema holds, asserted against the
// migrations themselves.
//
// These are ordinarily database tests: create a row, watch the constraint
// refuse it. The `db` vitest project's file list (`LIVE_SCHEMA_TESTS` in
// `vitest.config.ts`) is the owner's, so this suite reads the migration
// SQL instead and asserts that each invariant is *written down in the
// schema* rather than left to application code. That is the weaker half of
// the check and it is stated plainly: it proves the constraint exists and
// not that Postgres enforces it. The PR asks the owner for the two
// `LIVE_SCHEMA_TESTS` entries that would close the gap.
import "./env";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { topicOf } from "../../src/lib/db/topics";
import { FAMILY_OF, OPPORTUNITY_TYPES } from "../../src/lib/opportunities/types";

const MIGRATIONS = path.resolve(import.meta.dirname, "../../supabase/migrations");
const CORE = "20260906090000_opportunities_core.sql";
const SUPPLY = "20260906090100_opportunities_supply.sql";

const core = readFileSync(path.join(MIGRATIONS, CORE), "utf8");
const supply = readFileSync(path.join(MIGRATIONS, SUPPLY), "utf8");

/** The statements only. A "not present" assertion over a file that
 *  explains in prose why the thing is absent would fail on its own
 *  explanation. */
function statements(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

describe("ARCHITECTURE rule 6: migrations are topic-prefixed and topic-owned", () => {
  it("both files resolve to the opportunities sub-tokens and to no other topic", () => {
    expect(topicOf(CORE)).toEqual({ token: "opportunities_core", owner: "BP-040" });
    expect(topicOf(SUPPLY)).toEqual({ token: "opportunities_supply", owner: "BP-041" });
  });
});

describe("§7: the eight kinds and the three families are closed in the schema", () => {
  it("every type in the enum appears in the type check constraint", () => {
    const constraint = core.slice(core.indexOf("opportunities_type_closed"));
    for (const type of OPPORTUNITY_TYPES) {
      expect(constraint).toContain(`'${type}'`);
    }
  });

  it("the family constraint names exactly the three families", () => {
    expect(core).toContain("family in ('write', 'improve', 'fix')");
  });

  it("the stored family is a constrained mirror of the type-to-family map", () => {
    // The map is the source of truth; this constraint is the mirror. A
    // type the constraint maps differently would let the two disagree.
    const mirror = core.slice(
      core.indexOf("opportunities_family_matches_type"),
      core.indexOf("opportunities_evidence_family_agrees")
    );
    for (const type of OPPORTUNITY_TYPES) {
      const family = FAMILY_OF[type];
      const clause = mirror
        .split(/\bor\b/)
        .find((arm) => arm.includes(`'${type}'`));
      expect(clause, `no arm of the mirror constraint carries ${type}`).toBeDefined();
      expect(clause).toContain(`family = '${family}'`);
    }
  });

  it("the evidence blob's discriminator must equal the row's family", () => {
    expect(core).toContain("evidence ->> 'family' = family");
  });
});

describe("§7: `unblock` is instruction-shaped in the schema, not by convention", () => {
  it("a Fix row has no search and no band, and every other row has both", () => {
    expect(core).toContain("(family = 'fix') = (fit_band is null)");
    expect(core).toContain("(family = 'fix') = (target_query is null)");
  });

  it("the band column is closed to the three winnability handles", () => {
    expect(core).toContain("fit_band in ('winnable', 'reach', 'not-yet')");
  });

  it("only a Write row proposes a slug", () => {
    expect(core).toContain("(family = 'write') = (proposed_slug is not null)");
  });
});

describe("§7: the acceptance test is written once", () => {
  it("a before-update trigger refuses any change to it", () => {
    expect(core).toMatch(/create trigger opportunities_acceptance_immutable\s+before update on opportunities/);
    expect(core).toContain("new.acceptance is distinct from old.acceptance");
    expect(core).toContain("raise exception");
  });

  it("the invariant is the schema's, and no module in the engine restates it", () => {
    // Application-level guarding here would be a second home for the rule
    // and would not bind a hand-written update.
    const engine = path.resolve(import.meta.dirname, "../../src/lib/opportunities");
    const sources = readAllTs(engine);
    for (const [file, text] of sources) {
      expect(text, `${file} appears to re-implement acceptance immutability`).not.toMatch(
        /acceptance\s*!==?\s*.*acceptance/
      );
    }
  });

  it("acceptance and evidence cannot be null", () => {
    expect(core).toContain("alter column evidence set not null");
    expect(core).toContain("alter column acceptance set not null");
  });
});

describe("de-duplication is the index's, and it survives a null search", () => {
  it("the partial unique index covers open and queued rows only", () => {
    expect(core).toMatch(/create unique index opportunities_open_target_uniq/);
    expect(core).toContain("where status in ('open', 'queued')");
  });

  it("a null target_query is coalesced, so two instructions cannot both be admitted", () => {
    // Nulls are distinct in a unique index; without the coalesce the Fix
    // family would de-duplicate against nothing.
    expect(core).toContain("coalesce(target_query, '')");
  });

  it("effort is a number in the unit interval", () => {
    expect(core).toContain("numeric(3, 2)");
    expect(core).toContain("effort >= 0 and effort <= 1");
  });
});

describe("the supply migration adds one column and no counter", () => {
  it("`status_changed_at` and its trigger, and nothing else", () => {
    expect(supply).toContain("add column if not exists status_changed_at");
    expect(supply).toContain("new.status is distinct from old.status");
    expect(statements(supply)).not.toContain("supply_depth");
    expect(statements(supply)).not.toContain("materialized view");
  });

  it("the column moves only when the status does", () => {
    const body = supply.slice(supply.indexOf("opportunities_touch_status_changed_at"));
    expect(body).toContain("new.status_changed_at := now()");
    // One assignment, inside one condition: an unconditional touch would
    // move the date supply exhaustion is dated from on any update.
    expect(body.match(/new\.status_changed_at :=/g)).toHaveLength(1);
  });
});

function readAllTs(dir: string): [string, string][] {
  const out: [string, string][] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...readAllTs(full));
    else if (entry.endsWith(".ts")) out.push([full, readFileSync(full, "utf8")]);
  }
  return out;
}
