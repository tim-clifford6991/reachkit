/**
 * competitor-resolve.test.ts — name→domain matcher (launch-readiness A4).
 *
 * Guards the brand-ambiguity trap: a name-only competitor must resolve to its
 * OWN domain, never to an aggregator or a different product that merely shares
 * the name. When nothing clearly matches, resolve to null (don't guess).
 */

import { describe, it, expect } from "vitest";
import { pickDomainForName } from "./competitor-resolve";
import type { TavilyResult } from "./adapters/tavily";

const r = (title: string, url: string): TavilyResult => ({ title, url, content: "", publishedDate: null });

describe("pickDomainForName", () => {
  it("matches when the domain reflects the brand name", () => {
    expect(pickDomainForName("ShowMRR", [r("ShowMRR — track your revenue", "https://showmrr.com/")])).toBe("showmrr.com");
  });

  it("handles names that include a TLD-like suffix (Acquire.com)", () => {
    expect(pickDomainForName("Acquire.com", [r("Acquire.com - buy & sell startups", "https://acquire.com/")])).toBe("acquire.com");
  });

  it("skips aggregator/listicle hosts", () => {
    expect(
      pickDomainForName("ShowMRR", [
        r("ShowMRR Reviews 2026 | G2", "https://www.g2.com/products/showmrr"),
        r("ShowMRR on Product Hunt", "https://www.producthunt.com/products/showmrr"),
      ]),
    ).toBeNull();
  });

  it("is conservative — a title-only match on an unrelated domain resolves to null", () => {
    // The product's title names it, but the domain (getstartu.io) doesn't reflect
    // the brand — resolving here risks a wrong domain, so we leave it name-only.
    const got = pickDomainForName("StartuPage", [r("StartuPage — the fastest page builder", "https://getstartu.io/")]);
    expect(got).toBeNull();
  });

  it("returns null when nothing unambiguously matches (no wrong-domain guess)", () => {
    expect(
      pickDomainForName("Bloom", [
        r("Bloom & Wild — flower delivery", "https://bloomandwild.com/"),
        r("Bloom Energy — fuel cells", "https://bloomenergy.com/"),
      ]),
    ).toBeNull();
  });

  it("prefers the domain match over a later title match", () => {
    const got = pickDomainForName("ProvenMRR", [
      r("Some blog about ProvenMRR", "https://randomblog.com/provenmrr"),
      r("ProvenMRR", "https://provenmrr.io/"),
    ]);
    expect(got).toBe("provenmrr.io");
  });

  it("returns null on empty input", () => {
    expect(pickDomainForName("", [r("x", "https://x.com")])).toBeNull();
    expect(pickDomainForName("ShowMRR", [])).toBeNull();
  });
});
