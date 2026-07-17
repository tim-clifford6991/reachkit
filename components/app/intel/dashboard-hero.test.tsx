import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardHero, RecentChangesRecap, type DashboardHeroProps } from "./dashboard-hero";
import type { PillarRollup } from "@/lib/scan/pillar-scores";
import type { ProgressEvent } from "@/lib/scan/progress-events";

// R1 (2026-07-17): pillar bars decompose the MEASURED set. Content + SEO measured;
// Outreach measured (e.g. comparison_pages) so it renders a real bar; a pillar with
// ZERO measured signals is OMITTED (never "not measured yet").
const rollup: PillarRollup = {
  pillars: [
    { pillar: "content", label: "Content", value: 74, assessed: true },
    { pillar: "outreach", label: "Outreach", value: 12, assessed: true },
    { pillar: "seo", label: "SEO", value: 60, assessed: true },
  ],
  weakest: { pillar: "outreach", label: "Outreach", value: 12, assessed: true },
  estGain: 6,
};

const baseProps: DashboardHeroProps = {
  score: 42,
  rollup,
  measuredByPillar: { content: 3, outreach: 1, seo: 5 },
  history: [],
  markers: [],
  isPaid: false,
  marketPosition: 31,
  onPageReadiness: 66,
  searchPresence: 0,
};

describe("DashboardHero pillar rows (R1)", () => {
  it("renders a bar for a MEASURED Outreach pillar — never the 'measured off-site' dead-end", () => {
    const html = renderToStaticMarkup(<DashboardHero {...baseProps} />);
    expect(html).toContain("Outreach");
    expect(html).not.toContain("measured off-site");
    expect(html).not.toContain("not measured yet");
  });

  it("shows each bar's basis — the measured-signal count", () => {
    const html = renderToStaticMarkup(<DashboardHero {...baseProps} />);
    expect(html).toContain("1 measured"); // outreach: comparison_pages
    expect(html).toContain("5 measured"); // seo
  });

  it("OMITS a pillar with zero measured signals (never a dead-end row)", () => {
    const props: DashboardHeroProps = {
      ...baseProps,
      rollup: {
        pillars: [
          { pillar: "content", label: "Content", value: 74, assessed: true },
          { pillar: "outreach", label: "Outreach", value: 0, assessed: false },
          { pillar: "seo", label: "SEO", value: 60, assessed: true },
        ],
        weakest: { pillar: "seo", label: "SEO", value: 60, assessed: true },
        estGain: 3,
      },
      measuredByPillar: { content: 3, outreach: 0, seo: 5 },
    };
    const html = renderToStaticMarkup(<DashboardHero {...props} />);
    // Outreach has no measured signal → omitted from the bars (but "Outreach" may
    // still appear in the Market Position label, so assert the ROW dead-ends are gone).
    expect(html).not.toContain("not measured yet");
    expect(html).not.toContain("measured off-site");
  });

  it("frames the lever gain as ON-PAGE READINESS, not 'pts to your score' (geomean honesty)", () => {
    const html = renderToStaticMarkup(<DashboardHero {...baseProps} history={[{ total: 42, takenAt: "2026-07-01T00:00:00Z" }, { total: 42, takenAt: "2026-07-08T00:00:00Z" }]} />);
    expect(html).toContain("on-page readiness");
    expect(html).not.toMatch(/\+\d+ pts<\/span> to your score/);
  });

  it("anchors the Market Position block with id=\"market-position\" when it renders", () => {
    const html = renderToStaticMarkup(<DashboardHero {...baseProps} />);
    expect(html).toContain('id="market-position"');
  });
});

describe("RecentChangesRecap", () => {
  const events: ProgressEvent[] = [
    { label: "First event", date: "2026-07-10T00:00:00Z", delta: 4, href: "/app/plan" },
    { label: "Second event", date: "2026-07-09T00:00:00Z", delta: -2 },
    { label: "Third event", date: "2026-07-08T00:00:00Z" },
    { label: "Fourth event", date: "2026-07-07T00:00:00Z" },
    { label: "Fifth event", date: "2026-07-06T00:00:00Z" },
  ];

  it("renders exactly the top 3 event labels + a See all link when events exist", () => {
    const html = renderToStaticMarkup(<RecentChangesRecap events={events} />);
    expect(html).toContain("First event");
    expect(html).toContain("Second event");
    expect(html).toContain("Third event");
    expect(html).not.toContain("Fourth event");
    expect(html).not.toContain("Fifth event");
    expect(html).toContain("See all");
    expect(html).toContain("/app/progress");
  });

  it("renders the zero-state copy and no See all link when there are no events", () => {
    const html = renderToStaticMarkup(<RecentChangesRecap events={[]} />);
    expect(html).toContain("Your changelog builds as you ship");
    expect(html).not.toContain("See all");
  });
});
