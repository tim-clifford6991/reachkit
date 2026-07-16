import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardHero, RecentChangesRecap, type DashboardHeroProps } from "./dashboard-hero";
import type { PillarRollup } from "@/lib/scan/pillar-scores";
import type { ProgressEvent } from "@/lib/scan/progress-events";

// Outreach unassessed (measured off-site, not "not measured yet") + SEO unassessed
// (genuinely awaiting a scan, keeps "not measured yet"). SEO is normally always
// assessed in real data, but the render logic only branches on `p.assessed` /
// `p.pillar`, so this exercises both unassessed-render paths in one pass.
const rollup: PillarRollup = {
  pillars: [
    { pillar: "content", label: "Content", value: 0, assessed: false },
    { pillar: "outreach", label: "Outreach", value: 0, assessed: false },
    { pillar: "seo", label: "SEO", value: 0, assessed: false },
  ],
  weakest: null,
  estGain: 0,
};

const baseProps: DashboardHeroProps = {
  score: 42,
  rollup,
  history: [],
  markers: [],
  isPaid: false,
  marketPosition: 31,
  onPageReadiness: null,
  searchPresence: null,
};

describe("DashboardHero pillar rows", () => {
  it("points the unassessed Outreach pillar at Market Position instead of 'not measured yet'", () => {
    const html = renderToStaticMarkup(<DashboardHero {...baseProps} />);
    expect(html).toContain("measured off-site");
    expect(html).toContain("#market-position");
  });

  it("keeps 'not measured yet' for other unassessed pillars (content/seo)", () => {
    const html = renderToStaticMarkup(<DashboardHero {...baseProps} />);
    expect(html).toContain("not measured yet");
  });

  it("does NOT point Outreach at a dead #market-position link when there's no Market Position — the row says what produces the grade per tier (owner report 2026-07-17)", () => {
    const free = renderToStaticMarkup(<DashboardHero {...baseProps} marketPosition={null} isPaid={false} />);
    expect(free).not.toContain("#market-position");
    expect(free).toContain("measured off-site — part of the full report");

    const paid = renderToStaticMarkup(<DashboardHero {...baseProps} marketPosition={null} isPaid={true} />);
    expect(paid).not.toContain("#market-position");
    expect(paid).toContain("measured off-site — appears after your next re-scan");
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
