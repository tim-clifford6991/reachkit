/**
 * REPORT-CORPUS ACCEPTANCE RUBRIC — the pre-build acceptance oracle.
 *
 * Runs REAL captured `report_payload`s (`lib/scan/fixtures/report-corpus/*.json`,
 * frozen verbatim from live prod scans via `pnpm capture:report <scanId>`)
 * through the REAL public path — `publicReportProps` (free redaction +
 * fullGapQueries) → `toResultsProps` → `renderToStaticMarkup(<ResultsScreen/>)`
 * — and checks the rendered HTML against the rubric engine
 * (`lib/testing/report-rubric.ts`): R1 no garbage · R2 every number ≥10 has a
 * payload basis · R3 empty input ⇒ no section (and grounded input ⇒ section) ·
 * R4 teaser counts equal their rendered collection · R5 comparative copy only
 * when the comparison holds.
 *
 * This generalizes the classification-corpus ratchet one level up: every gate
 * before it (G1–G10) was created AFTER a failure the owner found reading live
 * renders; this runs that review on every `pnpm test`, on real payloads,
 * BEFORE anything ships. Per the Change Protocol's "Acceptance (corpus-first)"
 * clause: a user-visible report change adds/updates its expected outcome HERE
 * (a fixture expectation or a rubric rule) before the implementation lands.
 *
 * RATCHET RULES: fixtures + rubric rules only GROW (the manifest below);
 * per-fixture SUPPRESSIONS only SHRINK; expectations only TIGHTEN. Fixtures
 * are captured verbatim, never hand-authored (the react-email lesson — an
 * edited payload starves or feeds the checks dishonestly).
 *
 * MUTATION-PROVEN (each rule watched failing against a real fixture, then the
 * mutation reverted — "a guard you have not seen fail is not a guard"):
 *  R1 ← delete the `?? []` on categoryPhrases in to-results-props.ts
 *       (legacy resend fixture crashes / renders garbage)
 *  R2 ← render a literal/off-by-N number in results-screen.tsx
 *  R3 ← remove a `length > 0` section conditional in results-screen.tsx
 *  R4 ← reorder the fullGapQueries fallback chain in public-report.tsx
 *  R5 ← make the "…is your gap." driver line unconditional in results-screen.tsx
 *  manifest ← delete a fixture file
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsScreen } from "./results-screen";
import { publicReportProps } from "@/app/(funnel)/scan/[id]/public-report";
import { runReportRubric, RUBRIC_RULES } from "@/lib/testing/report-rubric";
import type { ReportPayload } from "@/lib/scan/report";

import getapp from "@/lib/scan/fixtures/report-corpus/getapp.com.json";
import reachkit from "@/lib/scan/fixtures/report-corpus/reachkit.app.json";
import resend from "@/lib/scan/fixtures/report-corpus/resend.com.json";
import savvycal from "@/lib/scan/fixtures/report-corpus/savvycal.com.json";
import spacex from "@/lib/scan/fixtures/report-corpus/spacex.com.json";
import xcom from "@/lib/scan/fixtures/report-corpus/x.com.json";

interface CorpusFixture {
  domain: string;
  siteUrl: string;
  archetype: string;
  scanId: string;
  tier: string;
  capturedAt: string;
  note?: string;
  reportPayload: ReportPayload;
}

// Captured payloads are verbatim prod JSON — older ones carry retired fields
// (resend's categoryCaptureRate) and legacy shapes the current types no longer
// name; that looseness is the point (the ?? [] rule gets real legacy inputs).
const FIXTURES = [getapp, reachkit, resend, savvycal, spacex, xcom] as unknown as CorpusFixture[];

/** Only-shrinks: rule ids suppressed per domain. Every entry is either a real
 *  bug awaiting its fix (linked) or a documented, reviewed exception. */
const SUPPRESSIONS: Record<string, string[]> = {};

// ── Manifest — the only-grows floor ─────────────────────────────────────────
const MIN_FIXTURES = 6;
const REQUIRED_ARCHETYPES = ["directory", "zero-ranking", "normal-saas", "pathological"];
const MIN_RUBRIC_RULES = 6; // raised from 5 when R6 (ladder sanity) landed — the floor only rises

function render(fx: CorpusFixture): string {
  const { resultsProps } = publicReportProps(fx.reportPayload, `corpus-${fx.domain}`, fx.siteUrl);
  return renderToStaticMarkup(<ResultsScreen {...resultsProps} scanId={`corpus-${fx.domain}`} />);
}

describe("report-corpus manifest (only grows)", () => {
  it(`holds ≥ ${MIN_FIXTURES} fixtures covering every required archetype`, () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(MIN_FIXTURES);
    for (const a of REQUIRED_ARCHETYPES) {
      expect(FIXTURES.some((f) => f.archetype === a), `archetype "${a}" must stay covered`).toBe(true);
    }
  });

  it("every fixture file on disk is registered in this test (a capture must be wired in)", () => {
    const files = readdirSync(join(process.cwd(), "lib/scan/fixtures/report-corpus")).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(FIXTURES.length);
  });

  it(`the rubric holds ≥ ${MIN_RUBRIC_RULES} rules (rules only grow)`, () => {
    expect(RUBRIC_RULES.length).toBeGreaterThanOrEqual(MIN_RUBRIC_RULES);
  });

  it("fixtures are verbatim captures: every one names its prod scanId + capture date", () => {
    for (const fx of FIXTURES) {
      expect(fx.scanId, `${fx.domain} must carry its scanId`).toMatch(/^[0-9a-f-]{36}$/);
      expect(fx.capturedAt, `${fx.domain} must carry its capture date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("report-corpus rubric — every captured payload renders clean through the REAL public path", () => {
  for (const fx of FIXTURES) {
    it(`${fx.domain} (${fx.archetype}): R1–R5 hold`, () => {
      const html = render(fx);
      const violations = runReportRubric(fx.reportPayload, html, { suppress: SUPPRESSIONS[fx.domain] ?? [] });
      expect(violations, violations.map((v) => `[${v.rule}] ${v.message}`).join("\n")).toEqual([]);
    });
  }
});

// ── Per-fixture expectations — hand-written, tighten-only (corpus idiom) ────

describe("corpus: getapp.com — directory whose footprint is other companies' names", () => {
  const html = render(FIXTURES.find((f) => f.domain === "getapp.com")!);
  it("renders the TRUE footprint totals, never the old capped-50 lie", () => {
    expect(html).toContain("120,578");
    expect(html).toContain("605,177");
  });
  it("the persisted legacy 'medium' rung NEVER renders (props-boundary defensive filter)", () => {
    expect(html).not.toContain("software review platforms");
    expect(html).not.toMatch(/MEDIUM/);
  });
  it("the ≥40% off-topic warning names the actual incidental keywords", () => {
    expect(html).toContain("amcs");
  });
  // TIGHTENED (2026-07-19 evening, the fix the KNOWN ISSUE note promised):
  // this pre-Task-B payload persists an INVERTED broad rung (broad demand 10
  // below the hero's 30). The props boundary now drops it (same discipline as
  // the `medium` filter) and rubric R6 pins the rule both ways.
  it("the persisted INVERTED broad rung (10 below the hero's 30) never renders", () => {
    expect(html).not.toContain("b2b software market");
    expect(html).not.toContain("Your category, where the plan below starts:");
  });
});

describe("corpus: reachkit.app — the 0-ranking new product (the invariant-#11 site)", () => {
  const html = render(FIXTURES.find((f) => f.domain === "reachkit.app")!);
  it("renders the zero-state hero, not a false win", () => {
    expect(html).toContain("ranks you for nothing yet");
    expect(html).toContain("Google ranks you for 0 searches.");
  });
  it("the demand hero reconciles: 111,620 with all three phrase chips", () => {
    expect(html).toContain("111,620");
    expect(html).toContain("seo tools");
    expect(html).toContain("competitor analysis tools");
    expect(html).toContain("keyword ranking tracker");
  });
  it("no wins strip, no off-topic warning — its inputs are genuinely empty", () => {
    expect(html).not.toContain("You rank in the top 3 for");
    expect(html).not.toContain("e.g. you rank for");
  });
});

describe("corpus: resend.com — legacy payload (pre-ladder fields, retired aliases)", () => {
  const html = render(FIXTURES.find((f) => f.domain === "resend.com")!);
  it("the capped sample is labelled a sample, never a total (G2/G3 on a real legacy row)", () => {
    // footprintComplete is ABSENT on this payload → defaults false → the
    // 50-keyword figure must carry the "top keywords" sample label.
    expect(html).toContain("top keywords ranked");
  });
  it("the retired capture-rate alias never renders (G1 on a payload that still carries it)", () => {
    expect(html).not.toMatch(/capture \d+%/i);
    expect(html).not.toContain("11,406");
  });
  it("renders its real competitor names", () => {
    expect(html).toContain("Mailgun");
    expect(html).toContain("Postmark");
  });
});

describe("corpus: savvycal.com — timezone-noise footprint (post-macro-rule)", () => {
  const html = render(FIXTURES.find((f) => f.domain === "savvycal.com")!);
  it("the biggest opportunity is a real category term, never a timezone lookup", () => {
    expect(html).toContain("scheduling software");
    const oppBlock = html.slice(html.indexOf("Your biggest untapped opportunity"));
    expect(oppBlock).not.toMatch(/what time is it/);
  });
  it("timezone lookups appear ONLY as named off-topic examples", () => {
    expect(html).toContain("what time is it at california");
  });
  it("a multi-phrase broad rung itemises every phrase so its total reconciles", () => {
    expect(html).toContain("18,820");
    expect(html).toContain("productivity software");
    expect(html).toContain("calendar management");
  });
});

describe("corpus: x.com — mega-brand footprint (post-macro-rule; Part C residual pinned)", () => {
  const html = render(FIXTURES.find((f) => f.domain === "x.com")!);
  it("opportunities are real category terms — no mega-brand 'biggest opportunity'", () => {
    expect(html).toContain("social media platform");
    const oppBlock = html.slice(html.indexOf("Your biggest untapped opportunity"));
    expect(oppBlock).not.toMatch(/google|fox news|usps/i);
  });
  it("the ladder renders both real rungs with reconciling totals", () => {
    expect(html).toContain("33,170");
    expect(html).toContain("social networking");
    expect(html).toContain("decentralized social networks");
  });
  // TIGHTENED (2026-07-19 evening): explicit terms are payload-grounded but
  // never rendered as NAMED examples on the conversion surface — the split
  // percentages still count them (`renderableExamples`, shared with the
  // rubric's R3 grounding predicate so render and rubric can't disagree).
  it("explicit off-topic examples are curated out; clean ones still render", () => {
    expect(html).not.toContain("porn hub");
    expect(html).toContain("youtube");
    expect(html).toContain("youcine");
  });
});

describe("corpus: spacex.com — the 8,170-demand class control (post-fix)", () => {
  const html = render(FIXTURES.find((f) => f.domain === "spacex.com")!);
  it("category demand is the REAL merged footprint (1,336,500), reconciled by its chips", () => {
    expect(html).toContain("1,336,500");
    expect(html).toContain("space exploration technologies");
  });
  it("the top opportunity carries the real near-miss position, not a bare 'Not winning'", () => {
    expect(html).toContain("#12"); // 'space', 368k/mo — a discoverable near-miss
    expect(html).toContain("368,000");
  });
  it("on-page (26) is the weaker driver here — the summary must say so (R5 converse)", () => {
    expect(html).toContain("On-page readiness is your gap.");
    expect(html).not.toContain("Search presence is your gap.");
  });
  it("wins strip: 3 wins, 3 chips, so no '+N more' disclosure", () => {
    expect(html).toContain("#2 space exploration technologies");
    expect(html).not.toMatch(/\+\d+ more/);
  });
});
