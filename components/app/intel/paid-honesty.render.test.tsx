import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReferrerRow } from "./referrer-row";
import { CompetitorGapMap } from "./competitor-gap-map";
import { Blocks } from "./dashboard-view";
import { meterBand } from "./plan-entry-card";
import type { Supply } from "./supply-view";

/**
 * Paid-surface number-claim-honesty render guards (Phase 5, R-1.10/R-6.7).
 *
 * The free report has the report-corpus rubric; the PAID surfaces are driven by
 * the intel cache (Supply/funnel), which has no capture path — so these guard the
 * reframed paid renders directly, the results-screen.render.test.tsx way. Each is
 * MUTATION-PROVEN: reverting the corresponding fix re-introduces the banned text.
 *
 *  Ri3 — no linking-host ETV magnitude rendered as referral traffic ("~84K").
 *  Ri4 — no "traffic by channel" donut / "Est. visits" magnitude; backlink counts.
 *  Ri5 — the competitor surface never labels backlink data "referrer/referral".
 */

// --- Ri3: ReferrerRow renders authority (DR), never the ETV magnitude ----------
describe("ReferrerRow — no ETV magnitude, authority instead (Ri3, R-6.7)", () => {
  const html = renderToStaticMarkup(
    <ReferrerRow r={{ host: "indiehackers.com", category: "community", url: "https://indiehackers.com/post/x", anchor: "acquire.com", target: "https://acquire.com", authority: 474, dofollow: true, etv: 84000, relevance: "core" }} />,
  );
  it("shows the honest DR authority signal", () => {
    expect(html).toContain("DR");
    expect(html).toContain("474");
  });
  it("never renders the linking host's ETV as a magnitude (the ~84K lie)", () => {
    expect(html).not.toContain("84K");
    expect(html).not.toContain("84k");
    expect(html).not.toMatch(/~\s*8[0-9],?[0-9]{3}/); // "~84,000" / "~84K"
    expect(html).not.toContain("platform reach");
    expect(html).not.toContain("monthly organic traffic");
  });
});

// --- Ri4/placement: gap-map is placement presence, not discovery/traffic -------
describe("CompetitorGapMap — placement presence, not traffic (Ri4, R-6.7)", () => {
  const html = renderToStaticMarkup(
    <CompetitorGapMap
      entities={[{ domain: "you.com", isSubject: true }, { domain: "rival.com" }]}
      channelStrength={{ "you.com": { community: "lo" }, "rival.com": { directories: "hi", community: "hi" } }}
      selected="you.com"
      onSelect={() => {}}
    />,
  );
  it("frames as a placement gap, not the old traffic/absent gap map", () => {
    expect(html).toContain("Placement gap");
    expect(html).toContain("get listed in");
    expect(html).toContain("placement presence");
    expect(html).not.toContain("Gap map — where you");
    expect(html).not.toContain("channels to enter");
  });
});

// --- Ri4: dashboard shows a backlink channel MIX (counts), never a traffic donut
function supply(): Supply {
  const bl = (byCategory: Record<string, number>) => ({
    topQualityReferrers: [{ host: "g2.com", category: "marketplace", url: "https://g2.com/x", authority: 90, dofollow: true, etv: 84000, relevance: "core" as const }],
    byCategory, qualityShare: 0.5, sampled: 20,
  });
  const mix = { organic: 0, referral: 0, social: 0, direct: 0, organicKeywords: 340, referringDomains: 42, socialMentions: 0 };
  return {
    funnel: {
      category: "notetaking",
      subject: { domain: "you.com", isSubject: true, monthlyTraffic: 5000, score: 40, band: "fair", mix, brandedSearchVolume: 100, topPagesCount: 5, category: "notetaking", backlinks: bl({ software_directory: 6, community: 3 }) },
      competitors: [{ domain: "rival.com", isSubject: false, monthlyTraffic: 84000, score: 70, band: "findable", mix, brandedSearchVolume: 5000, topPagesCount: 20, closeness: 4, reason: "similar", backlinks: bl({ marketplace: 12 }) }],
      discoveryChannels: { marketplace: 12 },
      channelsMissing: [{ action: "Get listed on G2", type: "marketplace", host: "g2.com", competitorsUsing: 1 }],
      channelStrength: { "you.com": { community: "lo" }, "rival.com": { marketplace: "hi" } },
    },
  } as unknown as Supply;
}

describe("dashboard Blocks — backlink channel mix, no traffic magnitude (Ri4, R-1.10)", () => {
  const html = renderToStaticMarkup(<Blocks data={supply()} />);
  it("renders the honest backlink channel mix (counts) + footprint comparison", () => {
    expect(html).toContain("backlink channel mix");
    expect(html).toContain("You vs. top competitors");
    expect(html).toContain("Directories"); // a byCategory channel label
  });
  it("never renders the traffic donut or ETV magnitudes", () => {
    expect(html).not.toContain("traffic by channel");
    expect(html).not.toContain("Est. visits");
    expect(html).not.toContain("Share of voice");
  });
});

// --- Ri6: Ease/Impact render as a 3-BAND categorical, never a fabricated % ------
describe("meterBand — 3-value LLM bucket → band, not fake precision (Ri6, R-1.10)", () => {
  it("maps the synthesize.ts EASE values (0.8/0.5/0.25) to High/Medium/Low", () => {
    expect(meterBand(0.8).band).toBe("High");
    expect(meterBand(0.5).band).toBe("Medium");
    expect(meterBand(0.25).band).toBe("Low");
  });
  it("maps the IMPACT values (0.85/0.55/0.3) to High/Medium/Low", () => {
    expect(meterBand(0.85).band).toBe("High");
    expect(meterBand(0.55).band).toBe("Medium");
    expect(meterBand(0.3).band).toBe("Low");
  });
  it("collapses to exactly 3 levels (there is no measured magnitude to show)", () => {
    const levels = new Set([0.8, 0.5, 0.25, 0.85, 0.55, 0.3].map((v) => meterBand(v).level));
    expect(levels).toEqual(new Set([1, 2, 3]));
  });
});
