// tests/market/rivals/derive.test.ts — BUILD §6.6
//
// The §6.6 partition, the score, the total tie-break, and the two
// properties the section states as promises rather than as steps: the
// derivation buys nothing, and its output does not move when the
// customer's own presence does.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveRivals } from "../../../src/lib/market/rivals/derive.ts";
import { BATTERY, RIVAL_SCORE } from "../../../src/lib/config/constants.ts";
import type { MarketSerp } from "../../../src/lib/market/views.ts";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/market/rivals/derive.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function serp(a: { organic?: string[]; cited?: string[] }): MarketSerp {
  return {
    organic: (a.organic ?? []).map((domain, i) => ({ position: i + 1, domain })),
    aiOverview: { present: (a.cited ?? []).length > 0, referenceDomains: a.cited ?? [] },
  };
}

describe('BUILD §6.6 — "score = top10Appearances + 2 × aiCitations (cited-by-AI weighs double)"', () => {
  it("deriveRivals/counts-once-per-serp — one domain twice on one SERP raises its count by 1, not 2", () => {
    const { rivals } = deriveRivals({
      serps: [serp({ organic: ["rival.com", "other.com", "rival.com"] })],
      ownDomain: "customer.com",
    });
    const rival = rivals.find((r) => r.domain === "rival.com");
    expect(rival?.top10Appearances).toBe(1);
  });

  it("deriveRivals/counts-once-per-serp — an AI Overview citing one domain twice cites it once", () => {
    const { rivals } = deriveRivals({
      serps: [serp({ cited: ["https://rival.com/a", "https://www.rival.com/b"] })],
      ownDomain: "customer.com",
    });
    expect(rivals.find((r) => r.domain === "rival.com")?.aiCitations).toBe(1);
  });

  it("deriveRivals/score-is-the-pinned-expression — every candidate's score is top10 + 2 × aiCitations", () => {
    const { rivals } = deriveRivals({
      serps: [
        serp({ organic: ["a.com", "b.com"], cited: ["a.com"] }),
        serp({ organic: ["a.com"], cited: ["b.com", "c.com"] }),
      ],
      ownDomain: "customer.com",
    });
    expect(rivals.length).toBeGreaterThan(0);
    for (const rival of rivals) {
      expect(rival.score).toBe(
        rival.top10Appearances * RIVAL_SCORE.top10Weight + rival.aiCitations * RIVAL_SCORE.aiCitationWeight
      );
    }
    // a.com: 2 top-ten + 1 citation = 4; b.com: 1 + 1 = 3; c.com: 0 + 1 = 2.
    expect(rivals.map((r) => [r.domain, r.score])).toEqual([
      ["a.com", 4],
      ["b.com", 3],
      ["c.com", 2],
    ]);
  });

  it("deriveRivals/ai-weighs-double — one AI citation outscores one top-ten appearance", () => {
    const { rivals } = deriveRivals({
      serps: [serp({ organic: ["organic-only.com"], cited: ["cited-only.com"] })],
      ownDomain: "customer.com",
    });
    expect(rivals[0]?.domain).toBe("cited-only.com");
  });
});

describe('BUILD §6.6 — "strip the customer\'s own domain … partition against PLATFORM_DOMAINS"', () => {
  it("deriveRivals/own-domain-never-a-rival — www. and the content. publishing subdomain are the customer, not a rival", () => {
    const { rivals, sources } = deriveRivals({
      serps: [serp({ organic: ["www.customer.com", "content.customer.com"], cited: ["customer.com"] })],
      ownDomain: "customer.com",
    });
    expect(rivals).toEqual([]);
    expect(sources).toEqual([]);
  });

  it("deriveRivals/platform-hits-go-to-sources-only — a platform domain never enters rivals", () => {
    const { rivals, sources } = deriveRivals({
      serps: [
        serp({ organic: ["reddit.com", "rival.com"], cited: ["quora.com"] }),
        serp({ organic: ["reddit.com"] }),
      ],
      ownDomain: "customer.com",
    });
    expect(rivals.map((r) => r.domain)).toEqual(["rival.com"]);
    expect(sources).toEqual(["reddit.com", "quora.com"]);
  });

  it("a store page is a listing: the app it lists is not a rival under the store's domain (issue 1417)", () => {
    const { rivals } = deriveRivals({
      serps: [serp({ organic: ["play.google.com", "apps.apple.com", "rival.com"] })],
      ownDomain: "customer.com",
    });
    expect(rivals.map((r) => r.domain)).toEqual(["rival.com"]);
  });

  it("a domain cited or ranking only for an article about others is their publisher, not a rival (issue 1417)", () => {
    const { rivals } = deriveRivals({
      serps: [
        {
          organic: [
            { position: 1, domain: "zapier.com", url: "https://zapier.com/blog/best-ai-visibility-tool/" },
            { position: 2, domain: "otterly.ai", url: "https://otterly.ai/" },
          ],
          aiOverview: {
            present: true,
            referenceDomains: ["hubspot.com", "otterly.ai"],
            referenceUrls: ["https://www.hubspot.com/products/marketing/aeo-guide", "https://otterly.ai/pricing"],
          },
        },
      ],
      ownDomain: "customer.com",
    });
    expect(rivals.map((r) => r.domain)).toEqual(["otterly.ai"]);
  });

  it("deriveRivals/sources-are-de-duplicated-in-first-seen-order", () => {
    const { sources } = deriveRivals({
      serps: [
        serp({ organic: ["youtube.com", "g2.com"] }),
        serp({ organic: ["g2.com", "youtube.com", "capterra.com"] }),
      ],
      ownDomain: "customer.com",
    });
    expect(sources).toEqual(["youtube.com", "g2.com", "capterra.com"]);
  });

  it("deriveRivals/unparseable-hosts-are-dropped — never counted as somebody", () => {
    const { rivals } = deriveRivals({
      serps: [serp({ organic: ["", "not a host", "192.0.2.1", "rival.com"] })],
      ownDomain: "customer.com",
    });
    expect(rivals.map((r) => r.domain)).toEqual(["rival.com"]);
  });
});

describe('BUILD §6.6 — "top 5 by score = suggested rivals"; fewer than five, and none, are legal results', () => {
  it("deriveRivals/top-five-by-score — a market with eight product domains returns exactly COMPETITORS_MAX", () => {
    const eight = ["a", "b", "c", "d", "e", "f", "g", "h"].map((n) => `${n}.com`);
    const { rivals } = deriveRivals({
      serps: eight.map((domain, i) => serp({ organic: Array(i + 1).fill(domain) })),
      ownDomain: "customer.com",
    });
    expect(rivals).toHaveLength(BATTERY.COMPETITORS_MAX);
  });

  it("deriveRivals/fewer-than-five-is-legal — two product domains return two rivals", () => {
    const { rivals } = deriveRivals({
      serps: [serp({ organic: ["one.com", "two.com", "reddit.com"] })],
      ownDomain: "customer.com",
    });
    expect(rivals).toHaveLength(2);
  });

  it("deriveRivals/fewer-than-five-is-legal — every result the customer's own or a platform returns no rivals and does not throw", () => {
    const { rivals, sources } = deriveRivals({
      serps: [serp({ organic: ["customer.com", "reddit.com", "medium.com"] })],
      ownDomain: "customer.com",
    });
    expect(rivals).toEqual([]);
    expect(sources).toEqual(["reddit.com", "medium.com"]);
  });

  it("deriveRivals/empty-market — no SERPs at all returns empty lists, not a throw", () => {
    expect(deriveRivals({ serps: [], ownDomain: "customer.com" })).toEqual({ rivals: [], sources: [] });
  });
});

describe('BUILD §6.6 — "the output is identical whether the customer ranks for 10,000 searches or none"', () => {
  it("deriveRivals/cold-start-is-the-path — the same market with and without the customer present returns an identical rival array", () => {
    const market = [
      serp({ organic: ["a.com", "b.com"], cited: ["a.com"] }),
      serp({ organic: ["b.com", "c.com"], cited: ["c.com"] }),
      serp({ organic: ["a.com", "c.com"] }),
    ];
    const withCustomer = market.map((s) =>
      serp({
        organic: ["customer.com", ...s.organic.map((r) => r.domain)],
        cited: ["customer.com", ...s.aiOverview.referenceDomains],
      })
    );

    const cold = deriveRivals({ serps: market, ownDomain: "customer.com" });
    const warm = deriveRivals({ serps: withCustomer, ownDomain: "customer.com" });
    expect(warm.rivals).toEqual(cold.rivals);
  });
});

describe("Determinism — identical SERPs in, byte-identical rival order out", () => {
  const tied = [
    serp({ organic: ["delta.com", "alpha.com", "echo.com"] }),
    serp({ organic: ["charlie.com", "bravo.com", "foxtrot.com"] }),
  ];

  it("deriveRivals/total-order-under-ties — six domains on an identical score come back in domain order", () => {
    const { rivals } = deriveRivals({ serps: tied, ownDomain: "customer.com" });
    expect(rivals.every((r) => r.score === 1)).toBe(true);
    expect(rivals.map((r) => r.domain)).toEqual([
      "alpha.com",
      "bravo.com",
      "charlie.com",
      "delta.com",
      "echo.com",
    ]);
  });

  it("deriveRivals/total-order-under-ties — a shuffled input produces the identical output", () => {
    const shuffled = [
      serp({ organic: ["foxtrot.com", "charlie.com", "bravo.com"] }),
      serp({ organic: ["echo.com", "alpha.com", "delta.com"] }),
    ];
    expect(deriveRivals({ serps: shuffled, ownDomain: "customer.com" }).rivals).toEqual(
      deriveRivals({ serps: tied, ownDomain: "customer.com" }).rivals
    );
  });

  it("deriveRivals/byte-identical-on-every-run — 50 runs over one fixture agree exactly", () => {
    const first = JSON.stringify(deriveRivals({ serps: tied, ownDomain: "customer.com" }));
    for (let i = 0; i < 50; i += 1) {
      expect(JSON.stringify(deriveRivals({ serps: tied, ownDomain: "customer.com" }))).toBe(first);
    }
  });
});

describe('BUILD §6.6 — "Zero extra cost — it counts over SERPs already bought"', () => {
  it("deriveRivals/buys-nothing — the module resolves no import into vendors, costs or llm, and takes no CostContext", () => {
    for (const forbidden of [
      /from\s+["'][^"']*lib\/vendors/,
      /from\s+["'][^"']*lib\/costs/,
      /from\s+["'][^"']*lib\/llm/,
      /from\s+["'][^"']*lib\/db/,
    ]) {
      expect(SOURCE).not.toMatch(forbidden);
    }
    expect(SOURCE).not.toMatch(/CostContext/);
  });

  it("deriveRivals/buys-nothing — the module opens no fetch and reads no clock", () => {
    expect(SOURCE).not.toMatch(/\bfetch\(/);
    expect(SOURCE).not.toMatch(/Date\.now\(\)/);
    expect(SOURCE).not.toMatch(/new Date\(/);
  });

  it("deriveRivals/no-inlined-weights — the score's two weights are read from the pin, not written here", () => {
    const body = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/import[^\n]*\n/g, "");
    expect(body).not.toMatch(/\b2\s*\*/);
    expect(body).toMatch(/RIVAL_SCORE\.aiCitationWeight/);
  });
});

describe("Observability — counts only, never a domain", () => {
  it("deriveRivals/logs-counts-not-domains", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    deriveRivals({ serps: [serp({ organic: ["rival.com", "reddit.com"] })], ownDomain: "customer.com" });
    const line = spy.mock.calls.at(-1)?.[0] as string;
    expect(JSON.parse(line)).toEqual({
      event: "rival_derivation",
      candidatesBeforePartition: 2,
      candidatesAfterPartition: 1,
      rivalsKept: 1,
    });
    expect(line).not.toContain("rival.com");
  });
});

describe("issue 1357 — an AI Overview whose sources were not loaded", () => {
  it("changes no rival's count: the SERP derives as it does without the overview", () => {
    const organic = [{ position: 1, domain: "rival.com" }];
    const unread = deriveRivals({
      serps: [{ organic, aiOverview: { present: true, referenceDomains: [], unread: true } }],
      ownDomain: "example.com",
    });
    const none = deriveRivals({ serps: [{ organic, aiOverview: { present: false, referenceDomains: [] } }], ownDomain: "example.com" });
    expect(unread).toEqual(none);
  });
});
