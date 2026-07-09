/**
 * Doc-contract tripwire.
 *
 * These constants are RESTATED verbatim in the living docs — CLAUDE.md's
 * "Invariants" section and docs/architecture.md §4.1 / key notes. They drifted
 * once already (PR #36 changed the headline model but the docs kept claiming the
 * old one, and were then "updated" to describe the broken state as sound).
 *
 * This test pins each documented value to its source constant. Changing a value
 * here forces you to touch this file — the checkpoint where you MUST also update
 * the doc that restates it. It does not prevent drift automatically; it makes
 * SILENT drift fail CI. If you change a value: update CLAUDE.md + architecture.md
 * (+ the score-model memory) in the SAME change, then update the expectation here.
 */
import { describe, it, expect } from "vitest";
import { HEADLINE_SCORE_VERSION, FIXED_BASIS_SIGNAL_KEYS } from "./registry-score";
import { PILLAR_WEIGHTS } from "./signals";
import { MAX_SELECTED } from "./competitor-selection";
import { MIN_ACTIONS } from "./action-linking";

describe("documented invariants (keep docs in sync when these change)", () => {
  it("headline score model is v4 — the on-site basis (CLAUDE.md invariant #1, architecture §4.1)", () => {
    expect(HEADLINE_SCORE_VERSION).toBe(4);
  });

  it("the fixed on-site headline basis is exactly the 8 HTML signals (CLAUDE.md invariant #1)", () => {
    expect([...FIXED_BASIS_SIGNAL_KEYS].sort()).toEqual(
      [
        "canonical_url",
        "content_depth",
        "heading_structure",
        "media_richness",
        "meta_description",
        "schema_jsonld",
        "social_share_tags",
        "title_tag",
      ],
    );
  });

  it("pillar weights are Content 0.30 / Outreach 0.25 / SEO 0.45, summing to 1 (architecture key notes)", () => {
    expect(PILLAR_WEIGHTS.content).toBeCloseTo(0.3, 5);
    expect(PILLAR_WEIGHTS.outreach).toBeCloseTo(0.25, 5);
    expect(PILLAR_WEIGHTS.seo).toBeCloseTo(0.45, 5);
    expect(PILLAR_WEIGHTS.content + PILLAR_WEIGHTS.outreach + PILLAR_WEIGHTS.seo).toBeCloseTo(1, 5);
  });

  it("competitor cohort cap is 5 (CLAUDE.md invariant #2, architecture §4.3)", () => {
    expect(MAX_SELECTED).toBe(5);
  });

  it("always-insight action floor is 5 (CLAUDE.md invariant #4)", () => {
    // The plan is floored to MIN_ACTIONS deterministic fixes so a report is never
    // empty. If this changes, update CLAUDE.md invariant #4 in the same commit.
    expect(MIN_ACTIONS).toBe(5);
  });
});
