/**
 * Security regression (final whole-cycle review, Critical): the PUBLIC report
 * at /report/[slug] must NEVER expose paid action drafts — it is reachable by
 * anyone with a scan UUID (no auth), so a leak there is both a paywall bypass
 * and a privacy leak. The page must redact to "free" and render the four
 * sections unlocked={false}.
 *
 * This renders the real ReportPage (server component) with serverDb mocked to
 * return a payload that DOES contain drafts, captures the props the page hands
 * to each section, and asserts: ActionPlanSection receives unlocked={false} and
 * every action's draft is null. Guards against a revert to unlocked={true} /
 * passing the raw payload.
 */

import { beforeEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReportPayload } from "@/lib/scan/report";

const SECRET = "SECRET_DRAFT_MUST_NOT_LEAK";

function makeAction(category: "content" | "outreach" | "seo_aso", title: string) {
  return {
    category,
    title,
    why: "because the evidence says so",
    evidenceIds: [] as number[],
    evidence: [],
    effortMin: 30,
    suggestedDeadline: "2026-06-25",
    expectedOutcome: { scoreComponent: category === "seo_aso" ? "seo" : category, delta: 5 },
    draft: SECRET,
    draftRequiresEdit: true as const,
    verification: { method: "url" as const, state: "pending" as const },
    basis: "evidence_based" as const,
    confidence: 0.8,
  };
}

const PAYLOAD: ReportPayload = {
  mode: "ios",
  generatedAt: "2026-06-13T00:00:00.000Z",
  whatYouOffer: {
    positioningMirror: { listingSays: "LISTING_PUBLIC", reviewsValue: "REVIEWS_PUBLIC", gap: "GAP_PUBLIC" },
  },
  whoItsFor: { summary: "ICP_PUBLIC", signals: ["s1", "s2"] },
  whereTheyAre: {
    surfaces: [{ source: "hn", title: "SURFACE_PUBLIC", url: "https://news.ycombinator.com/item?id=1" }],
    competitorGap: [{ competitor: "Comp", dimension: "presence", them: 1, you: 0 }],
  },
  whatToDoThisWeek: {
    quickWins: [makeAction("seo_aso", "Quick win")],
    medium: [makeAction("content", "Medium play"), makeAction("outreach", "Outreach play")],
    longPlay: [makeAction("content", "Long play")],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  score: { total: 42, breakdown: { content: 10, outreach: 5, seo: 20 }, radar: [{ axis: "Content", value: 10, active: true }], basis: "verified" } as any,
};

// Captured props the page hands each section.
type Captured = { name: string; props: Record<string, unknown> };
const captured: Captured[] = [];
function recorder(name: string) {
  return (props: Record<string, unknown>) => {
    captured.push({ name, props });
    return null;
  };
}

beforeEach(() => {
  captured.length = 0;
  vi.resetModules();
});

test("public /report/[slug] redacts to free — no paid drafts leak, sections locked", async () => {
  vi.doMock("@/lib/db/client", () => ({
    serverDb: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { report_payload: PAYLOAD }, error: null }),
          }),
        }),
      }),
    }),
  }));
  vi.doMock("next/navigation", () => ({ notFound: () => { throw new Error("notFound called"); } }));
  // Client components → inert stubs (avoid next/dynamic + client hooks in SSR)
  vi.doMock("@/app/report/[slug]/score-block", () => ({ ScoreBlock: () => null }));
  vi.doMock("@/app/report/[slug]/badge-embed", () => ({ BadgeEmbed: () => null }));
  // Section components → prop recorders
  vi.doMock("@/components/report/what-you-offer-section", () => ({ WhatYouOfferSection: recorder("offer") }));
  vi.doMock("@/components/report/who-its-for-section", () => ({ WhoItsForSection: recorder("audience") }));
  vi.doMock("@/components/report/where-they-are-section", () => ({ WhereTheyAreSection: recorder("channels") }));
  vi.doMock("@/components/report/action-plan-section", () => ({ ActionPlanSection: recorder("plays") }));
  vi.doMock("@/components/report/snapshot-strip", () => ({ SnapshotStrip: () => null }));

  // Render the async content directly (the page wraps it in <Suspense>, which
  // renderToStaticMarkup can't resolve; ReportContent is the data+render unit).
  const { ReportContent } = await import("@/app/report/[slug]/page");
  const element = await ReportContent({ slug: "scan-uuid-1" });
  const html = renderToStaticMarkup(element);

  // 1. The draft string never appears anywhere in the rendered output.
  expect(html).not.toContain(SECRET);

  // 2. The action-plan section is rendered LOCKED with draft-null actions.
  const plays = captured.find((c) => c.name === "plays");
  expect(plays).toBeDefined();
  expect(plays?.props["unlocked"]).toBe(false);
  const week = plays?.props["whatToDoThisWeek"] as ReportPayload["whatToDoThisWeek"];
  const allActions = [...week.quickWins, ...week.medium, ...week.longPlay];
  expect(allActions.length).toBeGreaterThanOrEqual(1);
  expect(allActions.every((a) => a.draft === null)).toBe(true);

  // 3. The other sections are also locked; the page DID pass the public teaser
  //    content (positioning) to the offer section — proves the report rendered
  //    and that non-draft teaser content is intentionally still surfaced.
  for (const name of ["offer", "audience", "channels"]) {
    expect(captured.find((c) => c.name === name)?.props["unlocked"]).toBe(false);
  }
  const offer = captured.find((c) => c.name === "offer");
  expect(JSON.stringify(offer?.props ?? {})).toContain("LISTING_PUBLIC");
}, 30_000);
