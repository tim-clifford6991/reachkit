/**
 * PAID-SURFACE ACCEPTANCE RUBRIC — the in-app dashboard hero, driven by the
 * REAL report corpus through the REAL production computation.
 *
 * The free rubric (report-corpus.rubric.test.tsx) guards the public `/scan`
 * render; the paid in-app surface renders through a DIFFERENT component set
 * (the intel kit) and had almost no render-honesty coverage. This closes the
 * hero half: every corpus fixture's verbatim `report_payload` runs through
 * `buildDashboardHeroProps` (the ONE pure builder the dashboard page calls —
 * extracted from `app/(app)/app/dashboard/page.tsx` so this test drives
 * production code, not a replica) with no live signal rows — the REAL fallback
 * path for a scan whose `scan_signals` were pruned — then renders the REAL
 * `DashboardHero` and checks the intel rubric: R1 (no garbage) + R2i (every
 * rendered number ≥10 derives from the driving data).
 *
 * ACTIVATION NOTE (REQUIREMENTS.md OPEN(O-4)): the corpus currently holds
 * free-tier fixtures; the same machinery runs a tier=full fixture the moment
 * one is captured (`pnpm capture:report 35e30a99-… --archetype=normal-saas`,
 * prod creds required — the cardpointers deep scan is warm) — then raise
 * MIN_INTEL_RULES/add the full-tier floor here. The intel-BLOCKS half
 * (Supply/keyword-gap views) additionally needs the intel-cache fixture
 * (reachkit.app's cache is warm; zero spend).
 *
 * MUTATION-PROVEN: render a literal in dashboard-hero.tsx → R2i fires on
 * every fixture; drop the `marketPosition != null` guard → R1 fires.
 */

import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardHero } from "./dashboard-hero";
import { WhatToRankFor } from "./rank-targets";
import { buildDashboardHeroProps } from "@/lib/app/dashboard-hero-props";
import { buildRankTargets } from "@/lib/app/rank-targets-props";
import { runIntelRubric, INTEL_RUBRIC_RULES } from "@/lib/testing/report-rubric";
import type { ReportPayload } from "@/lib/scan/report";

import getapp from "@/lib/scan/fixtures/report-corpus/getapp.com.json";
import reachkit from "@/lib/scan/fixtures/report-corpus/reachkit.app.json";
import resend from "@/lib/scan/fixtures/report-corpus/resend.com.json";
import savvycal from "@/lib/scan/fixtures/report-corpus/savvycal.com.json";
import spacex from "@/lib/scan/fixtures/report-corpus/spacex.com.json";
import xcom from "@/lib/scan/fixtures/report-corpus/x.com.json";

interface CorpusFixture {
  domain: string;
  tier: string;
  reportPayload: ReportPayload & { score: { total: number; breakdown: { content: number; outreach: number; seo: number } } };
}

const FIXTURES = [getapp, reachkit, resend, savvycal, spacex, xcom] as unknown as CorpusFixture[];

/** Only-grows floor for the paid rule set (independent of the free floor). */
const MIN_INTEL_RULES = 2;

describe("paid-surface rubric manifest (only grows)", () => {
  it(`the intel rubric holds ≥ ${MIN_INTEL_RULES} rules`, () => {
    expect(INTEL_RUBRIC_RULES.length).toBeGreaterThanOrEqual(MIN_INTEL_RULES);
  });
});

describe("paid dashboard hero — every corpus payload renders clean through the REAL builder", () => {
  for (const fx of FIXTURES) {
    it(`${fx.domain} (tier=${fx.tier}): R1 + R2i hold on the hero render`, () => {
      // No live signal rows — the production fallback path (score_total +
      // persisted breakdown), which is exactly how a pruned/legacy scan
      // renders and what a captured payload can drive alone.
      const heroScore = buildDashboardHeroProps({
        signalRows: [],
        scoreTotal: fx.reportPayload.score.total,
        scoreBreakdown: fx.reportPayload.score.breakdown,
        reportPayload: fx.reportPayload,
      });
      const data = { ...heroScore, history: [], markers: [], isPaid: true, events: [] };
      const html = renderToStaticMarkup(<DashboardHero {...data} />);
      const violations = runIntelRubric(data, html);
      expect(violations, violations.map((v) => `[${v.rule}] ${v.message}`).join("\n")).toEqual([]);

      // Variant 2 — the live-rows shape: when scan_signals exist, production
      // passes real driver values, which unhides the on-page/search chips (and
      // MARKET POSITION on a deep payload). Drive them from the payload's own
      // persisted drivers so R2i actually checks the chips — without this
      // variant the fallback render hides them and R2i is near-vacuous
      // (discovered when a chip mutation failed to fire).
      const sv = fx.reportPayload.searchVisibility;
      const data2 = {
        ...data,
        onPageReadiness: sv?.onPageReadiness ?? null,
        searchPresence: sv?.score ?? null,
      };
      const html2 = renderToStaticMarkup(<DashboardHero {...data2} />);
      const violations2 = runIntelRubric(data2, html2);
      expect(violations2, violations2.map((v) => `[${v.rule}] ${v.message}`).join("\n")).toEqual([]);
    });
  }

  // Generic advice that must NEVER render — the action plan always pushes a
  // SPECIFIC artifact (owner rule 2026-07-22). If any of these appear, a row
  // degraded to general filler.
  const GENERIC_ADVICE = [
    "improve your content", "increase your visibility", "boost your ranking",
    "optimize your site", "enhance your presence", "grow your audience",
  ];

  for (const fx of FIXTURES) {
    it(`${fx.domain}: "What to rank for" renders SPECIFIC, actionable targets (R1 + R2i + actionability)`, () => {
      const props = buildRankTargets(fx.reportPayload);
      const html = renderToStaticMarkup(<WhatToRankFor {...props} />);

      // R1 (no garbage) + R2i (every rendered number ≥10 derives from the props).
      const violations = runIntelRubric(props, html);
      expect(violations, violations.map((v) => `[${v.rule}] ${v.message}`).join("\n")).toEqual([]);

      // Never general advice — the through-line requirement.
      for (const g of GENERIC_ADVICE) expect(html.toLowerCase()).not.toContain(g);

      if (props.targets.length > 0) {
        // Every shown target is a CONCRETE move — "Create a page targeting «kw»"
        // with its real keyword. Depth: the board shows the moves, not a teaser.
        expect(html).toContain("Create a page targeting");
        for (const t of props.targets.slice(0, 12)) {
          expect(html, `${fx.domain}: target "${t.keyword}" must render`).toContain(t.keyword);
        }
      } else {
        // Honest zero-state — a fabricated row would be worse than none.
        expect(html).toContain("No category searches measured yet");
      }
    });
  }

  // M1 unify (2026-07-23): the rival "why" rides the ONE spine, read from the
  // deep scan's persisted `market.gap.keywordGap` — no metered second gather.
  // Corpus fixtures are free-tier (no `market`), so a paid payload is synthesized
  // here from a real fixture: inject a rival gap on the spine's own top target and
  // prove the "N rivals rank · best #P" line renders AND survives R2i (the count +
  // position derive from the props, not a literal). Mutation-proven: delete the
  // rival <div> in rank-targets.tsx → the toContain assertions fail; render a bare
  // literal there → R2i fires.
  it("rival 'why' renders on a paid payload (market.gap) and derives under R2i", () => {
    // Any fixture that surfaces a spine target works — pick the first one so the
    // guard doesn't pin a specific corpus entry (which may lose targets on recapture).
    const base = FIXTURES.map((fx) => ({ fx, spine: buildRankTargets(fx.reportPayload) })).find((c) => c.spine.targets.length > 0);
    expect(base, "at least one fixture must surface a spine target to enrich").toBeTruthy();
    const lead = base!.spine.targets[0]!;

    // A paid payload = the free fixture + a persisted rival gap on the lead term.
    const paid = {
      ...base!.fx.reportPayload,
      market: { gap: { keywordGap: [{ keyword: lead.keyword, volume: lead.volume, rivalsRanking: 12, bestRivalPosition: 14 }] } },
    } as unknown as CorpusFixture["reportPayload"];

    const props = buildRankTargets(paid);
    const enriched = props.targets.find((t) => t.keyword === lead.keyword);
    expect(enriched?.rivalsRanking, "lead target must carry the persisted rival count").toBe(12);
    expect(enriched?.bestRivalPosition).toBe(14);

    const html = renderToStaticMarkup(<WhatToRankFor {...props} />);
    expect(html).toContain("12 rivals rank");
    expect(html).toContain("best #14");

    // R2i: the rival count (12) + position (14) must DERIVE from the props, never
    // a literal — the whole point of the unify (data, not decoration).
    const violations = runIntelRubric(props, html);
    expect(violations, violations.map((v) => `[${v.rule}] ${v.message}`).join("\n")).toEqual([]);
  });

  it("the builder preserves invariant #1 on the fallback path: gauge == persisted score_total", () => {
    for (const fx of FIXTURES) {
      const heroScore = buildDashboardHeroProps({
        signalRows: [],
        scoreTotal: fx.reportPayload.score.total,
        scoreBreakdown: fx.reportPayload.score.breakdown,
        reportPayload: fx.reportPayload,
      });
      expect(heroScore.score, `${fx.domain}: fallback gauge must equal the persisted unified score`).toBe(fx.reportPayload.score.total);
    }
  });
});
