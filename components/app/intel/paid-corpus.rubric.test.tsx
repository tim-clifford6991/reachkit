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
import { buildDashboardHeroProps } from "@/lib/app/dashboard-hero-props";
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
