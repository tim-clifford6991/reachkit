// tests/market/rivals/candidates.test.ts — SPEC §6 right-sizing, §6.6
// (issue 901)
//
// Which domains a pass spends its sizing on, read off the questions it
// actually asked. Pure over SERPs already bought: no vendor, no clock, no
// cost context anywhere in this file or the one it tests.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serpRivalCandidates } from "../../../src/lib/market/rivals/candidates.ts";
import { SERP_RIVAL_SIZING } from "../../../src/lib/config/constants.ts";
import type { MarketSerp } from "../../../src/lib/market/views.ts";

const SOURCE = readFileSync(
  path.resolve(import.meta.dirname, "../../../src/lib/market/rivals/candidates.ts"),
  "utf8"
);

function serp(domains: readonly string[]): MarketSerp {
  return {
    organic: domains.map((domain, i) => ({ position: i + 1, domain })),
    aiOverview: { present: false, referenceDomains: [] },
  };
}

const MANY = SERP_RIVAL_SIZING.candidatesMax;

describe("the candidates are the domains of the pass's own top tens", () => {
  it("the customer's own domain, a platform and an unparseable host are never candidates", () => {
    const picked = serpRivalCandidates({
      serps: [serp(["customer.com", "www.customer.com", "reddit.com", "not a host", "rival.com"])],
      ownDomain: "customer.com",
      max: MANY,
    });
    expect(picked).toEqual(["rival.com"]);
  });

  it("a domain twice on one top ten counts once, and the same domain across two counts twice", () => {
    const picked = serpRivalCandidates({
      serps: [serp(["a.com", "b.com", "a.com"]), serp(["b.com", "c.com"])],
      ownDomain: "customer.com",
      max: MANY,
    });
    // `b.com` is in both, so it leads on appearances; `a.com` and `c.com`
    // appear once each and are taken a round later, one per SERP.
    expect(picked[0]).toBe("b.com");
    expect(new Set(picked)).toEqual(new Set(["a.com", "b.com", "c.com"]));
  });

  it("orders by how often a domain appears, then by how well it ranks, then by name", () => {
    const picked = serpRivalCandidates({
      serps: [serp(["often.com", "high.com", "low.com"]), serp(["often.com"])],
      ownDomain: "customer.com",
      max: MANY,
    });
    expect(picked).toEqual(["often.com", "high.com", "low.com"]);
  });

  it("two domains alike on both counts are ordered by name, whichever order the SERPs put them in", () => {
    // Both hold position 1 of one search and position 2 of the other, so
    // appearances and best position tie and only the name is left. Without
    // that last key the same two SERPs would produce two different lists.
    const one = serpRivalCandidates({
      serps: [serp(["z.com", "a.com"]), serp(["a.com", "z.com"])],
      ownDomain: "customer.com",
      max: MANY,
    });
    const other = serpRivalCandidates({
      serps: [serp(["a.com", "z.com"]), serp(["z.com", "a.com"])],
      ownDomain: "customer.com",
      max: MANY,
    });
    expect(one).toEqual(["a.com", "z.com"]);
    expect(other).toEqual(["a.com", "z.com"]);
  });
});

describe("every question's own top ten gets a candidate before any gets a second", () => {
  it("a market whose head domains repeat does not spend the whole allowance on them", () => {
    // Four searches. Three share the same two large domains; the fourth —
    // the long-tail one a cold-start site is actually offered — holds a
    // domain of its own. With three candidates to spend, the small one is
    // still among them.
    const picked = serpRivalCandidates({
      serps: [
        serp(["giant.com", "big.com"]),
        serp(["giant.com", "big.com"]),
        serp(["giant.com", "big.com"]),
        serp(["giant.com", "reachable.com"]),
      ],
      ownDomain: "customer.com",
      max: 3,
    });
    expect(picked).toContain("reachable.com");
  });

  it("never more than the max, and never a domain twice", () => {
    const serps = Array.from({ length: 12 }, (_, i) =>
      serp([`giant.com`, `mid-${i}.com`, `small-${i}.com`])
    );
    const picked = serpRivalCandidates({ serps, ownDomain: "customer.com", max: MANY });
    expect(picked).toHaveLength(MANY);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it("a max of zero asks for nothing, and no SERPs yield nothing", () => {
    expect(serpRivalCandidates({ serps: [serp(["a.com"])], ownDomain: "c.com", max: 0 })).toEqual([]);
    expect(serpRivalCandidates({ serps: [], ownDomain: "c.com", max: MANY })).toEqual([]);
  });

  it("the same SERPs always produce the same list", () => {
    const serps = [serp(["a.com", "b.com"]), serp(["b.com", "c.com"]), serp(["c.com", "a.com"])];
    const once = serpRivalCandidates({ serps, ownDomain: "customer.com", max: MANY });
    const twice = serpRivalCandidates({ serps, ownDomain: "customer.com", max: MANY });
    expect(once).toEqual(twice);
  });
});

describe("§6.6's zero extra cost — this module buys nothing", () => {
  it("resolves no import into the vendor, cost or model clients", () => {
    for (const forbidden of ["@/lib/vendors", "@/lib/costs", "@/lib/llm"]) {
      expect(SOURCE).not.toContain(forbidden);
    }
  });
});
