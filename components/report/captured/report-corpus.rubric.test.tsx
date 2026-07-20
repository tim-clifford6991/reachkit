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
 *  R7 ← delete the scrubNumerals() call on listingSays in to-results-props.ts
 *       (getapp.com's real "45,000+ options" identity claim renders again)
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
const MIN_RUBRIC_RULES = 8; // raised from 7 when R8 (terseness, P4) landed — the floor only rises

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
    it(`${fx.domain} (${fx.archetype}): R1–R8 hold`, () => {
      const html = render(fx);
      const violations = runReportRubric(fx.reportPayload, html, { suppress: SUPPRESSIONS[fx.domain] ?? [] });
      expect(violations, violations.map((v) => `[${v.rule}] ${v.message}`).join("\n")).toEqual([]);
    });
  }
});

// ── P4 (2026-07-20) — the terseness ratchet: written FIRST, before the
// implementation, per the Change Protocol's corpus-first discipline. Every
// assertion here failed on the pre-P4 board (the prose R8 exists to strip)
// and must hold on every REAL captured payload, not just a synthetic one.
describe("P4 terseness — the free board is data-driven (titles + keywords + numbers), never long sentences", () => {
  for (const fx of FIXTURES) {
    it(`${fx.domain}: Positioning Mirror never renders (was the worst prose violation)`, () => {
      const html = render(fx);
      expect(html).not.toContain("Positioning Mirror");
      expect(html).not.toContain("Whether your page reads as the audience you actually want.");
    });

    it(`${fx.domain}: no fix card renders its LLM why-sentence`, () => {
      const html = render(fx);
      const acts = fx.reportPayload.whatToDoThisWeek;
      for (const a of [...acts.quickWins, ...acts.medium, ...acts.longPlay]) {
        if (a.why && a.why.trim().length > 0) {
          expect(html, `${fx.domain}: fix why-sentence "${a.why}" must not render verbatim`).not.toContain(a.why);
        }
      }
    });

    it(`${fx.domain}: section-subtitle sentences are absent`, () => {
      const html = render(fx);
      expect(html).not.toContain("What buyers search, what you capture, who takes the rest.");
      expect(html).not.toContain("Ordered by expected score impact.");
      expect(html).not.toMatch(/Free scans show \d+ of \d+\./);
    });

    it(`${fx.domain}: the category zero-state is "None yet." only, no trailing sentence`, () => {
      const html = render(fx);
      expect(html).not.toContain("You don't rank for a single term in your own category.");
    });

    it(`${fx.domain}: the rivalry line (when it renders) is a keyword tease, never the old prose`, () => {
      const html = render(fx);
      expect(html).not.toContain("and rivals are taking the searches above");
      expect(html).not.toContain("Unlock to see how each one ranks, why they win");
    });

    it(`${fx.domain}: exactly ONE upgrade CTA renders ("Unlock the full plan")`, () => {
      const html = render(fx);
      const matches = html.match(/Unlock the full plan/g) ?? [];
      // hideUnlock is always false on the public path, so every corpus
      // fixture must carry exactly one — never zero (both CTAs deleted) and
      // never two (the collapse didn't happen).
      expect(matches.length).toBe(1);
      // The retired second CTA card's own heading must never render either.
      expect(html).not.toContain("Close the gap before your rivals widen it");
    });
  }

  // Mutation-proof idiom (documented, not re-run here — see the docblock at
  // the top of this file's "MUTATION-PROVEN" list): re-adding any ONE of the
  // BANNED_PROSE strings in report-rubric.ts to results-screen.tsx flips the
  // "R1–R8 hold" test above red for every fixture that renders that section —
  // verified live during this phase (positioning-mirror block restored →
  // getapp.com/reachkit.app/resend.com/savvycal.com/x.com/spacex.com all failed
  // R8; reverted → green).
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
  // E3 (2026-07-20) — the REAL numeral-guard defect this corpus fixture
  // exhibits: getapp.com's captured listingSays reads "GetApp is a large
  // software directory with 45,000+ options and 2.5 million user reviews,
  // backed by 16+ years of market presence." — an unmeasured third-party
  // claim the identity strip used to render verbatim (the trustmrr
  // "180,000 monthly visitors" class, on real prod data).
  it("the 45,000+/16+ years identity claim is scrubbed — an unmeasured number, never rendered as ours", () => {
    expect(html).not.toContain("45,000+");
    expect(html).not.toContain("16+ years of market presence");
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
  // Review fix (IMPORTANT C, Part C): this capture predates the fetchDegraded
  // field entirely (absent from the JSON) — the props boundary defaults it to
  // false, so the honest degrade disclosure must never appear on a payload
  // that never carried it.
  it("carries no fetchDegraded — the disclosure line does not render", () => {
    expect(html).not.toMatch(/couldn(?:'|’|&#x27;)t fully read this page/);
  });
});

// ── Part C review fix (IMPORTANT C, corpus-first) — the fetchDegraded shape ─
//
// CONSTRUCTED, NOT a verbatim capture. Part C's honest degrade-state field
// (`fetchDegraded`) postdates every payload above — none of the 6 real
// captures were scanned through the escalation path, so there is no real
// prod payload carrying it yet to capture. Per the corpus's OWN manifest rule
// ("fixtures are captured verbatim, never hand-authored — the react-email
// lesson"), a hand-authored fixture must NOT be added to
// lib/scan/fixtures/report-corpus/ or counted toward MIN_FIXTURES/the
// manifest's file-count check; it lives in this separate, clearly-labeled
// describe block instead.
//
// This layers TWO synthetic things onto the REAL x.com capture (the
// mega-brand SPA-fetch site Part C's escalation targets): `fetchDegraded:
// true`, and a non-empty `positioningMirror.listingSays` (x.com's real
// capture already has an EMPTY listingSays, which would make the "identity
// line is blanked" assertion vacuously true even without the belt fix in
// to-results-props.ts — a stale, non-empty mirror is the actual case the
// belt guards against, e.g. a refresh persisting an older good mirror over a
// scan whose LATEST fetch degraded). Everything else is the real capture, so
// the render still exercises the REAL public path against otherwise-real
// data.
//
// TODO (post-merge, per CLAUDE.md "always live-test against REAL adapters"):
// once Part C is live-verified, a fresh x.com scan should be captured
// (`pnpm capture:report`) and this block retired in favor of the real
// re-capture asserting the same expectations, tightened per the corpus's
// tighten-only discipline (the note this fixture's own capture anticipates).
describe("corpus (CONSTRUCTED variant, review fix — not a verbatim capture): fetchDegraded shape", () => {
  const xcomFixture = FIXTURES.find((f) => f.domain === "x.com")!;
  // No apostrophe — renderToStaticMarkup HTML-escapes `'` to `&#x27;`, so a
  // literal apostrophe in this string would make `.not.toContain` trivially
  // true regardless of whether the belt actually stripped anything (a
  // vacuous check, the exact trap CLAUDE.md's guard-honesty rule warns
  // about) — verified: this text WAS caught red by the mutation proof below.
  const STALE_MIRROR_TEXT = "X is the place where the world goes to talk about what is happening right now.";
  const degradedVariant: CorpusFixture = {
    ...xcomFixture,
    domain: "x.com (constructed: fetchDegraded)",
    reportPayload: {
      ...xcomFixture.reportPayload,
      fetchDegraded: true,
      whatYouOffer: {
        ...xcomFixture.reportPayload.whatYouOffer,
        positioningMirror: {
          ...xcomFixture.reportPayload.whatYouOffer.positioningMirror,
          listingSays: STALE_MIRROR_TEXT,
        },
      },
    },
  };
  const html = render(degradedVariant);

  it("renders the honest 'couldn't fully read this page' disclosure", () => {
    expect(html).toMatch(/We couldn(?:'|’|&#x27;)t fully read this page \(it renders in the browser\)\. On-page findings may be incomplete\./);
  });

  it("identityLine is blanked even though positioningMirror.listingSays is non-empty (the belt)", () => {
    expect(html).not.toContain(STALE_MIRROR_TEXT);
    expect(html).not.toContain("the place where the world goes");
  });

  it("still passes the rubric (R1–R6) with fetchDegraded layered onto real data", () => {
    const violations = runReportRubric(degradedVariant.reportPayload, html);
    expect(violations, violations.map((v) => `[${v.rule}] ${v.message}`).join("\n")).toEqual([]);
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
    // Scoped to the YOUR CATEGORY card specifically (review fix, 2026-07-20:
    // the legacy opportunity block below it now ALSO renders its own terse
    // "+N more" chip for the locked gap rows — a real, unrelated tease — so a
    // page-wide regex would false-positive on that chip instead of proving
    // anything about the wins strip this test names).
    const categoryCardBlock = html.slice(html.indexOf("searches/mo across your category"), html.indexOf("Your biggest untapped opportunity"));
    expect(categoryCardBlock).not.toMatch(/\+\d+ more/);
  });
});

// ── Data board P3 review fix (2026-07-20, corpus-first) — the six-section board ─
//
// CONSTRUCTED, NOT verbatim captures. `categoryCard`/`nicheCard` (P2) and
// `aggregatedPct`/`aggregatedExamples` (P1) postdate every payload above —
// none of the 6 real captures ran through the P1/P2 pipeline, so there is no
// real prod payload carrying them yet to capture (no live Supabase access
// from this environment either). Per the corpus's OWN manifest rule ("never
// hand-authored, added to lib/scan/fixtures/report-corpus/"), these variants
// are NOT added as fixture files and are NOT counted toward MIN_FIXTURES —
// same precedent as the `fetchDegraded` CONSTRUCTED block above: real base
// payload, one field layered on top, clearly labelled, own describe block.
//
// The numbers are the LIVE P2 data verified on prod the same day this phase
// was speced (2026-07-20, task-P3-brief.md): reachkit.app "SEO and marketing
// tools" 112,900 / niche "SEO gap analysis for founders" 1,300; savvycal.com
// "Scheduling software" 3,350,000 / niche "Collaborative team scheduling"
// 240; x.com "Social media platforms" 168,820 / niche 350; trustmrr.com
// "Business Marketplace & Acquisition" 2,240,000 / niche 0 + aggregatedPct
// 78. trustmrr.com has no real base fixture in this corpus (only getapp.com
// covers the "directory" archetype) — its variant layers trustmrr's numbers
// onto getapp.com's real base (also a real directory scan), simulating the
// aggregation-strip case rather than claiming it as getapp's own data.
//
// P3fix (2026-07-20, LIVE DEFECT caught the same day, task-P3fix-brief.md):
// the trustmrr "Business Marketplace & Acquisition" 2,240,000 number above
// was the BUG — the ladder had picked the BARE generic noun "marketplace"
// (real Amazon/Facebook Marketplace search volume, meaningless for a
// startup-MRR directory) because it was grounded but not required to be
// MEANINGFUL (retain a real qualifier token). `computeCategoryLadder` now
// rejects a bare `CATEGORY_SUFFIX_TOKENS` noun even when grounded and even
// when it clears CATEGORY_FLOOR (see search-visibility.ts's
// `isMeaningfulCategoryHead`) — trustmrr's honest, corrected category is the
// real grounded phrase it actually ranks for, "startup acquisition
// marketplace" (8,100/mo — real, moderate, sub-floor; an honest number beats
// a fake huge one, D2). The niche card ALSO used to be OMITTED when its
// demand was genuinely 0 — it now renders an honest empty state instead
// (`<NicheEmptyCard>`) so the two-card layout holds.
//
// TODO (post-merge, per CLAUDE.md "always live-test against REAL adapters"):
// once a fresh scan of each domain is available on prod, `pnpm capture:report`
// should replace these constructs with real captures and this block retired,
// same as the fetchDegraded block's own TODO above.
function marketCard(over: { label: string; demand: number; rankedTop3?: { keyword: string; volume: number; yourPosition?: number }[]; gaps?: { keyword: string; volume: number }[] }) {
  const rankedTop3 = over.rankedTop3 ?? [];
  const gaps = over.gaps ?? [];
  // `phrases` is rankedTop3 ∪ gaps exactly (the same partition
  // `splitRankedGaps`/`computeCategoryLadder` produces) — computed here so
  // every constructed card is internally consistent (CategoryLadderCard's
  // `demand` reconciles to `phrases`), never hand-duplicated per call site.
  return { label: over.label, demand: over.demand, phrases: [...rankedTop3, ...gaps], rankedTop3, gaps };
}

describe("data board P3 (CONSTRUCTED variants, corpus-first — not verbatim captures): the six-section board", () => {
  const reachkitFixture = FIXTURES.find((f) => f.domain === "reachkit.app")!;
  const savvycalFixture = FIXTURES.find((f) => f.domain === "savvycal.com")!;
  const xcomFixture = FIXTURES.find((f) => f.domain === "x.com")!;
  const getappFixture = FIXTURES.find((f) => f.domain === "getapp.com")!;

  const reachkitP3: CorpusFixture = {
    ...reachkitFixture,
    domain: "reachkit.app (constructed: P3 category/niche cards)",
    reportPayload: {
      ...reachkitFixture.reportPayload,
      searchVisibility: {
        ...reachkitFixture.reportPayload.searchVisibility!,
        categoryCard: marketCard({
          label: "SEO and marketing tools",
          demand: 112900,
          gaps: [{ keyword: "seo tools", volume: 71600 }, { keyword: "seo software", volume: 41300 }],
        }),
        nicheCard: marketCard({
          label: "SEO gap analysis for founders",
          demand: 1300,
          gaps: [{ keyword: "seo gap analysis", volume: 1300 }],
        }),
      },
    },
  };

  const savvycalP3: CorpusFixture = {
    ...savvycalFixture,
    domain: "savvycal.com (constructed: P3 category/niche cards)",
    reportPayload: {
      ...savvycalFixture.reportPayload,
      searchVisibility: {
        ...savvycalFixture.reportPayload.searchVisibility!,
        categoryCard: marketCard({
          label: "Scheduling software",
          demand: 3350000,
          gaps: [{ keyword: "scheduling software", volume: 1900000 }, { keyword: "online scheduling tool", volume: 1450000 }],
        }),
        nicheCard: marketCard({
          label: "Collaborative team scheduling",
          demand: 240,
          gaps: [{ keyword: "team scheduling software", volume: 240 }],
        }),
      },
    },
  };

  const xcomP3: CorpusFixture = {
    ...xcomFixture,
    domain: "x.com (constructed: P3 category/niche cards)",
    reportPayload: {
      ...xcomFixture.reportPayload,
      searchVisibility: {
        ...xcomFixture.reportPayload.searchVisibility!,
        categoryCard: marketCard({
          label: "Social media platforms",
          demand: 168820,
          gaps: [{ keyword: "social media platform", volume: 98820 }, { keyword: "social networking site", volume: 70000 }],
        }),
        nicheCard: marketCard({
          label: "decentralized social networks",
          demand: 350,
          gaps: [{ keyword: "decentralized social networks", volume: 350 }],
        }),
      },
    },
  };

  // The directory-pattern case (D3): trustmrr.com's verified live numbers,
  // layered onto getapp.com's real base (also a directory scan — see the
  // block comment above for why trustmrr itself has no base fixture here).
  // P3fix: the category is now the CORRECTED honest number (8,100 — real,
  // moderate, sub-floor) instead of the bare-generic "marketplace" 2,240,000
  // bug. Niche demand is genuinely 0 (no grounded niche phrase cleared
  // pricing) — the niche card now renders the honest EMPTY STATE (label +
  // "no measurable niche demand yet"), not an omission. The aggregation
  // strip must still fire (aggregatedPct 78 ≥ 40).
  const directoryP3: CorpusFixture = {
    ...getappFixture,
    domain: "getapp.com (constructed: P3 directory pattern, trustmrr.com live numbers)",
    reportPayload: {
      ...getappFixture.reportPayload,
      searchVisibility: {
        ...getappFixture.reportPayload.searchVisibility!,
        categoryCard: marketCard({
          label: "Startup acquisition marketplace",
          demand: 8100,
          gaps: [{ keyword: "startup acquisition marketplace", volume: 8100 }],
        }),
        nicheCard: marketCard({ label: "MRR verification for acquirers", demand: 0 }), // 0 grounded phrases — genuinely empty
        aggregatedPct: 78,
        aggregatedExamples: ["cometly", "trimrx", "spanglish translator"],
        offTopicPct: 5, // residual noise, now that aggregatedPct owns the directory share (D3)
      },
    },
  };

  const P3_VARIANTS = [
    { name: "reachkit.app", fx: reachkitP3, categoryDemand: "112,900", nicheDemand: "1,300", categoryLabel: "SEO and marketing tools", nicheLabel: "SEO gap analysis for founders" },
    { name: "savvycal.com", fx: savvycalP3, categoryDemand: "3,350,000", nicheDemand: "240", categoryLabel: "Scheduling software", nicheLabel: "Collaborative team scheduling" },
    { name: "x.com", fx: xcomP3, categoryDemand: "168,820", nicheDemand: "350", categoryLabel: "Social media platforms", nicheLabel: "decentralized social networks" },
  ];

  for (const v of P3_VARIANTS) {
    describe(`${v.name}: the six-section board renders`, () => {
      const html = render(v.fx);
      it("renders the Overview hero stat (the CATEGORY size, the large number)", () => {
        expect(html).toContain(v.categoryDemand);
        // renderToStaticMarkup HTML-escapes the apostrophe in "you're" to
        // &#x27; — split the check either side of it (same idiom as the
        // fetchDegraded STALE_MIRROR_TEXT comment above).
        expect(html).toContain("searches/mo in your market");
        expect(html).toContain("in a real category");
      });
      it("renders the Category card (large) and the Niche card (small) as two DISTINCT numbers", () => {
        expect(html).toContain(v.categoryLabel);
        expect(html).toContain(v.nicheLabel);
        expect(html).toContain(v.nicheDemand);
        // Never the same number twice under two different labels (G1's spirit).
        expect(v.categoryDemand).not.toBe(v.nicheDemand);
      });
      it("the Opportunity section (niche gaps) renders — 'Opportunity · your niche'", () => {
        expect(html).toContain("Opportunity · your niche");
      });
      it("the LEGACY 'biggest untapped opportunity' callout is superseded, not duplicated", () => {
        expect(html).not.toContain("Your biggest untapped opportunity");
      });
      it("the aggregation strip does NOT render — this is a normal SaaS/mega-brand footprint, not a directory", () => {
        expect(html).not.toContain("your directory engine, not lost buyers");
        expect(html).not.toContain("DIRECTORY PATTERN DETECTED");
      });
      it("the pre-P2 ladder hero ('searches/mo across your category') is superseded, not duplicated", () => {
        expect(html).not.toContain("searches/mo across your category");
      });
      it("passes the full rubric (R1–R7) with categoryCard/nicheCard layered onto real data", () => {
        const violations = runReportRubric(v.fx.reportPayload, html);
        expect(violations, violations.map((x) => `[${x.rule}] ${x.message}`).join("\n")).toEqual([]);
      });
    });
  }

  describe("getapp.com (directory pattern, trustmrr.com live numbers): the aggregation strip", () => {
    const html = render(directoryP3);
    it("the DIRECTORY PATTERN strip renders with the real aggregatedPct + named examples", () => {
      expect(html).toContain("DIRECTORY PATTERN DETECTED");
      expect(html).toContain("78%");
      expect(html).toContain("your directory engine, not lost buyers");
      expect(html).toContain("cometly");
      expect(html).toContain("trimrx");
    });
    it("the Category card renders the CORRECTED honest number (8,100), never the bare-generic 'marketplace' 2,240,000 (P3fix)", () => {
      expect(html).toContain("8,100");
      expect(html).not.toContain("2,240,000");
      expect(html).toContain("Startup acquisition marketplace");
      // The fabricated bare-generic label must never appear either.
      expect(html).not.toContain("Business Marketplace");
    });
    it("the Niche card renders the honest EMPTY STATE (label + 'no measurable niche demand yet') — niche demand is genuinely 0, but the card is not omitted (P3fix)", () => {
      expect(html).toContain("MRR verification for acquirers");
      expect(html).toContain("No measurable niche demand yet");
    });
    it("the Opportunity section is still OMITTED — the empty-state niche card has nothing to itemise (invariant #11)", () => {
      expect(html).not.toContain("Opportunity · your niche");
    });
    it("passes the full rubric (R1–R7)", () => {
      const violations = runReportRubric(directoryP3.reportPayload, html);
      expect(violations, violations.map((x) => `[${x.rule}] ${x.message}`).join("\n")).toEqual([]);
    });
  });

  describe("mutation proof: the aggregation-strip conditional is directory-only (≥40%)", () => {
    it("savvycal.com and x.com (aggregatedPct 0, unset) never render the strip even though other blocks are active", () => {
      expect(render(savvycalP3)).not.toContain("DIRECTORY PATTERN DETECTED");
      expect(render(xcomP3)).not.toContain("DIRECTORY PATTERN DETECTED");
    });
    it("the SAME getapp.com base with aggregatedPct dropped to 39 (just under the floor) drops the strip", () => {
      const justUnder: CorpusFixture = {
        ...directoryP3,
        reportPayload: { ...directoryP3.reportPayload, searchVisibility: { ...directoryP3.reportPayload.searchVisibility!, aggregatedPct: 39 } },
      };
      expect(render(justUnder)).not.toContain("DIRECTORY PATTERN DETECTED");
    });
    it("the SAME base at exactly 40 renders the strip (the floor is inclusive)", () => {
      const atFloor: CorpusFixture = {
        ...directoryP3,
        reportPayload: { ...directoryP3.reportPayload, searchVisibility: { ...directoryP3.reportPayload.searchVisibility!, aggregatedPct: 40 } },
      };
      expect(render(atFloor)).toContain("DIRECTORY PATTERN DETECTED");
    });
  });
});
