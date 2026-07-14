import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardHero, type DashboardHeroProps } from "./dashboard-hero";
import type { PillarRollup } from "@/lib/scan/pillar-scores";

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

  it("anchors the Market Position block with id=\"market-position\" when it renders", () => {
    const html = renderToStaticMarkup(<DashboardHero {...baseProps} />);
    expect(html).toContain('id="market-position"');
  });
});
