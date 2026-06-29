import { describe, it, expect } from "vitest";
import { parseRankOverview, parseBacklinksSummary } from "./seo";

describe("parseRankOverview", () => {
  it("pulls organic keyword count + ETV", () => {
    const body = {
      tasks: [{ result: [{ items: [{ metrics: { organic: { count: 1234, etv: 56.7 } } }] }] }],
    };
    expect(parseRankOverview(body)).toEqual({ organicKeywords: 1234, etv: 56.7, paidKeywords: 0, paidEtv: 0 });
  });
  it("also pulls the paid block when present", () => {
    const body = {
      tasks: [{ result: [{ items: [{ metrics: { organic: { count: 1234, etv: 56.7 }, paid: { count: 8, etv: 40 } } }] }] }],
    };
    expect(parseRankOverview(body)).toEqual({ organicKeywords: 1234, etv: 56.7, paidKeywords: 8, paidEtv: 40 });
  });
  it("returns zeros for an empty/unknown shape", () => {
    expect(parseRankOverview({})).toEqual({ organicKeywords: 0, etv: 0, paidKeywords: 0, paidEtv: 0 });
    expect(parseRankOverview(null)).toEqual({ organicKeywords: 0, etv: 0, paidKeywords: 0, paidEtv: 0 });
  });
});

describe("parseBacklinksSummary", () => {
  it("pulls authority rank + referring domains", () => {
    const body = { tasks: [{ result: [{ rank: 412, referring_domains: 89, backlinks: 5000 }] }] };
    expect(parseBacklinksSummary(body)).toEqual({ authority: 412, referringDomains: 89 });
  });
  it("returns nulls (no data, not zero) for an empty shape", () => {
    expect(parseBacklinksSummary({})).toEqual({ authority: null, referringDomains: null });
    expect(parseBacklinksSummary(null)).toEqual({ authority: null, referringDomains: null });
  });
  it("returns numeric zeros when the result exists but counts are 0", () => {
    const body = { tasks: [{ result: [{ rank: 0, referring_domains: 0 }] }] };
    expect(parseBacklinksSummary(body)).toEqual({ authority: 0, referringDomains: 0 });
  });
});
