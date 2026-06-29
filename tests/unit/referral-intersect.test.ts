import { describe, it, expect } from "vitest";
import {
  classifyReferrer,
  isUbiquitousHost,
  isCustomerEmbedTld,
  isGenericAuthority,
  isSpamHost,
  isNoiseHost,
  normalizeHost,
} from "@/lib/scan/referral/classify";
import { rankOpportunities, type ReferralRow } from "@/lib/scan/referral/intersect";
import { discoverReferralChannels } from "@/lib/scan/referral/discover";
import { parseClassifications } from "@/lib/scan/referral/classify-pages";
import type { IntersectionRow } from "@/lib/scan/adapters/dataforseo-backlinks";
import type { Referrer } from "@/lib/scan/referral/types";

describe("classify", () => {
  it("normalizes hosts", () => {
    expect(normalizeHost("https://www.reddit.com/r/nocode/wiki")).toBe("reddit.com");
  });
  it("flags noise classes, not niche", () => {
    expect(isUbiquitousHost("google.com")).toBe(true);
    expect(isUbiquitousHost("m.facebook.com")).toBe(true);
    expect(isCustomerEmbedTld("stanford.edu")).toBe(true);
    expect(isCustomerEmbedTld("nsw.gov.au")).toBe(true);
    expect(isCustomerEmbedTld("indiehackers.com")).toBe(false);
    expect(isGenericAuthority("amazon.com")).toBe(true);
    expect(isGenericAuthority("businessinsider.com")).toBe(true);
    expect(isGenericAuthority("glassdoor.ca")).toBe(true); // brand-label match across ccTLDs
    expect(isGenericAuthority("n8n.io")).toBe(false);
  });
  it("flags SEO link-farm / site-worth spam", () => {
    expect(isSpamHost("q-links-bhs.xyz")).toBe(true);
    expect(isSpamHost("getwebsiteworth.com")).toBe(true);
    expect(isSpamHost("sitelike.org")).toBe(true);
    expect(isSpamHost("beehiiv.com")).toBe(false);
  });
  it("isNoiseHost honors the exclude set (competitors/self)", () => {
    expect(isNoiseHost("calendly.com", new Set(["calendly.com"]))).toBe(true);
    expect(isNoiseHost("zapier.com", new Set(["calendly.com"]))).toBe(false);
  });
  it("classifies channel types", () => {
    expect(classifyReferrer("reddit.com", "https://reddit.com/r/nocode")).toBe("community");
    expect(classifyReferrer("g2.com", "https://g2.com/products/x")).toBe("marketplace");
    expect(classifyReferrer("foo.beehiiv.com", "https://foo.beehiiv.com/p/i")).toBe("newsletter");
    expect(classifyReferrer("z.xyz", "https://z.xyz/page")).toBe("other");
  });
});

const row = (host: string, competitorHosts: string[]): ReferralRow => ({
  host,
  competitorHosts,
  exampleUrl: `https://${host}`,
});

describe("rankOpportunities", () => {
  const ctx = (over: Partial<Parameters<typeof rankOpportunities>[1]> = {}) => ({
    selfHosts: new Set<string>(),
    traffic: new Map<string, number>(),
    exclude: new Set<string>(),
    minCompetitors: 2,
    ...over,
  });

  it("keeps platforms feeding ≥2 competitors, drops singletons", () => {
    const rows = [row("nicheforum.com", ["a.com", "b.com"]), row("solo.com", ["a.com"])];
    const { opportunities } = rankOpportunities(rows, ctx());
    expect(opportunities.map((o) => o.host)).toEqual(["nicheforum.com"]);
  });

  it("splits subject-present rows into `shared`", () => {
    const rows = [row("nicheforum.com", ["a.com", "b.com"])];
    const { opportunities, shared } = rankOpportunities(rows, ctx({ selfHosts: new Set(["nicheforum.com"]) }));
    expect(opportunities).toHaveLength(0);
    expect(shared.map((o) => o.host)).toEqual(["nicheforum.com"]);
  });

  it("drops noise: ubiquitous, customer-embed, generic, excluded", () => {
    const rows = [
      row("google.com", ["a.com", "b.com"]),
      row("stanford.edu", ["a.com", "b.com"]),
      row("amazon.com", ["a.com", "b.com"]),
      row("a.com", ["b.com", "c.com"]),
      row("keepme.com", ["a.com", "b.com"]),
    ];
    const { opportunities } = rankOpportunities(rows, ctx({ exclude: new Set(["a.com"]) }));
    expect(opportunities.map((o) => o.host)).toEqual(["keepme.com"]);
  });

  it("ranks by traffic × coverage", () => {
    const rows = [row("big.com", ["a.com", "b.com"]), row("small.com", ["a.com", "b.com"])];
    const traffic = new Map([
      ["big.com", 100000],
      ["small.com", 100],
    ]);
    const { opportunities } = rankOpportunities(rows, ctx({ traffic }));
    expect(opportunities[0].host).toBe("big.com");
  });

  it("drops referrers below the traffic floor (kills zero-traffic spam)", () => {
    const rows = [row("real.com", ["a.com", "b.com"]), row("deadspam.com", ["a.com", "b.com"])];
    const traffic = new Map([["real.com", 9000]]); // deadspam.com → 0
    const { opportunities } = rankOpportunities(rows, ctx({ traffic, minRefererTraffic: 300 }));
    expect(opportunities.map((o) => o.host)).toEqual(["real.com"]);
  });
});

describe("parseClassifications (Task 6b)", () => {
  const hosts = ["webcatalog.io", "moz.com", "godaddy.com", "unknown.com"];
  it("keeps joinable channels, force-drops tools/competitors even if model says actionable", () => {
    const raw = JSON.stringify([
      { host: "webcatalog.io", type: "directory", actionable: true, action: "Submit your tool" },
      { host: "moz.com", type: "competitor", actionable: true, action: "x" }, // model wrong → must drop
      { host: "godaddy.com", type: "tool_or_platform", actionable: true, action: "x" }, // must drop
      { host: "notinlist.com", type: "blog", actionable: true, action: "x" }, // not in hosts → ignored
    ]);
    const out = parseClassifications(raw, hosts);
    const byHost = Object.fromEntries(out.map((c) => [c.host, c]));
    expect(byHost["webcatalog.io"].actionable).toBe(true);
    expect(byHost["moz.com"].actionable).toBe(false); // competitor never actionable
    expect(byHost["godaddy.com"].actionable).toBe(false); // tool_or_platform never actionable
    expect(out.find((c) => c.host === "notinlist.com")).toBeUndefined();
  });
});

describe("discoverReferralChannels (injected adapters)", () => {
  const intersection: IntersectionRow[] = [
    { referringHost: "nicheforum.com", targetIdxs: [0, 1], exampleUrl: "https://nicheforum.com" },
    { referringHost: "shared.com", targetIdxs: [0, 1], exampleUrl: "https://shared.com" },
  ];
  const selfRefs: Referrer[] = [
    { referringUrl: "https://shared.com/x", referringHost: "shared.com", targetUrl: "", anchorText: "" },
  ];

  it("returns ranked opportunities the subject lacks; measured=true", async () => {
    const out = await discoverReferralChannels({
      selfDomain: "self.com",
      competitorDomains: ["compa.com", "compb.com"],
      fetchIntersectionFn: async () => ({ rows: intersection }),
      fetchSelfReferrersFn: async () => selfRefs,
      fetchTrafficFn: async () => new Map([["nicheforum.com", 8000], ["shared.com", 5000]]),
    });
    expect(out.measured).toBe(true);
    expect(out.opportunities.map((o) => o.host)).toEqual(["nicheforum.com"]);
    expect(out.shared.map((o) => o.host)).toEqual(["shared.com"]);
  });

  it("measured=false when fewer than 2 competitors", async () => {
    const out = await discoverReferralChannels({
      selfDomain: "self.com",
      competitorDomains: ["only.com"],
    });
    expect(out.measured).toBe(false);
  });

  it("measured=false when no data anywhere", async () => {
    const out = await discoverReferralChannels({
      selfDomain: "self.com",
      competitorDomains: ["compa.com", "compb.com"],
      fetchIntersectionFn: async () => ({ rows: [] }),
      fetchSelfReferrersFn: async () => [],
      fetchTrafficFn: async () => new Map(),
    });
    expect(out.measured).toBe(false);
  });
});
