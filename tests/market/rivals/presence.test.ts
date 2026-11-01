// tests/market/rivals/presence.test.ts — BUILD §6.6
//
// One denominator, zero-as-a-measurement, the absent-from list, the two
// framing states — and the type-level absence assertions that are the only
// thing holding this card's honesty bound: the card has nowhere to put a
// rival's size, a severity, a ratio or a market-total volume, so no
// surface can render one.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildPresenceCard, type PresenceCard } from "../../../src/lib/market/rivals/presence.ts";
import type { RivalCandidate } from "../../../src/lib/market/rivals/derive.ts";
import { ABSENT_FROM_MAX } from "../../../src/lib/config/constants.ts";
import { measured, unmeasured, type Measured } from "../../../src/lib/measure/measured.ts";
import type { MarketSerp, SelectedSearchView } from "../../../src/lib/market/views.ts";

const SOURCE_PATH = path.resolve(import.meta.dirname, "../../../src/lib/market/rivals/presence.ts");
const SOURCE = readFileSync(SOURCE_PATH, "utf8");
const AT = new Date("2026-09-05T10:00:00.000Z");

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function serp(domains: string[]): MarketSerp {
  return {
    organic: domains.map((domain, i) => ({ position: i + 1, domain })),
    aiOverview: { present: false, referenceDomains: [] },
  };
}

const ok = (domains: string[]): Measured<MarketSerp> => measured(serp(domains), AT);
const missing = (): Measured<MarketSerp> => unmeasured<MarketSerp>("not_attempted", AT);

function search(keyword: string, volume: number): SelectedSearchView {
  return { keyword, volume };
}

function candidate(domain: string): RivalCandidate {
  return { domain, top10Appearances: 0, aiCitations: 0, score: 0 };
}

/** Twelve searches; the customer holds a top-ten place on two of them. */
function twelve(): { serps: Measured<MarketSerp>[]; selected: SelectedSearchView[] } {
  const serps: Measured<MarketSerp>[] = [];
  const selected: SelectedSearchView[] = [];
  for (let i = 0; i < 12; i += 1) {
    const holders = i < 2 ? ["customer.com", "rival-a.com"] : ["rival-a.com", "rival-b.com"];
    serps.push(ok(holders));
    selected.push(search(`search ${String(i).padStart(2, "0")}`, 100 + i));
  }
  return { serps, selected };
}

describe('REQ-008 c1 — the customer and each rival, with a name and a value, over the market\'s biggest searches', () => {
  it("card/you-and-each-rival-carry-name-and-count", () => {
    const { serps, selected } = twelve();
    const card = buildPresenceCard({
      serps,
      selected,
      ownDomain: "customer.com",
      rivals: [candidate("rival-a.com"), candidate("rival-b.com")],
    });

    expect(card.you).toEqual({ domain: "customer.com", top10Count: 2 });
    expect(card.rivals).toEqual([
      { domain: "rival-a.com", top10Count: 12 },
      { domain: "rival-b.com", top10Count: 10 },
    ]);
  });

  it("card/rivals-keep-the-order-they-were-given — score order, not re-sorted here", () => {
    const { serps, selected } = twelve();
    const card = buildPresenceCard({
      serps,
      selected,
      ownDomain: "customer.com",
      rivals: [candidate("rival-b.com"), candidate("rival-a.com")],
    });
    expect(card.rivals.map((r) => r.domain)).toEqual(["rival-b.com", "rival-a.com"]);
  });
});

describe('REQ-008 c2 — "0 is shown against the same denominator as every rival — never an error, a blank card, or a ratio"', () => {
  it("card/zero-against-the-same-denominator", () => {
    const serps = Array.from({ length: 12 }, () => ok(["rival-a.com", "rival-b.com"]));
    const selected = Array.from({ length: 12 }, (_, i) => search(`q${i}`, 10 + i));
    const card = buildPresenceCard({ serps, selected, ownDomain: "customer.com", rivals: [candidate("rival-a.com")] });

    expect(card.you.top10Count).toBe(0);
    expect(card.measuredSearches).toBe(12);
    expect(card.rivals[0]?.top10Count).toBe(12);
    expect(card.framing).toBe("shown");
  });

  it("card/zero-against-the-same-denominator — `you` carries no ratio, share or percentage field", () => {
    const card = buildPresenceCard({ serps: [ok([])], selected: [search("q", 1)], ownDomain: "customer.com", rivals: [] });
    expect(Object.keys(card.you).sort()).toEqual(["domain", "top10Count"]);
  });
});

describe("The one denominator — every figure is counted over the searches actually measured", () => {
  it("card/denominator-is-what-was-measured — four unmeasured of twelve leaves eight", () => {
    const { serps, selected } = twelve();
    for (const i of [3, 5, 7, 9]) serps[i] = missing();
    const card = buildPresenceCard({ serps, selected, ownDomain: "customer.com", rivals: [candidate("rival-a.com")] });

    expect(card.measuredSearches).toBe(8);
    expect(card.rivals[0]?.top10Count).toBeLessThanOrEqual(8);
    expect(card.you.top10Count).toBe(2);
  });

  it("card/one-presence-figure — the card's keys are exactly the six the interface declares", () => {
    const card = buildPresenceCard({ serps: [ok([])], selected: [search("q", 1)], ownDomain: "customer.com", rivals: [] });
    expect(Object.keys(card).sort()).toEqual(["absentFrom", "framing", "measuredSearches", "mostSearched", "rivals", "you"]);
  });

  it("card/most-searched — the biggest measured search and its first place, whether or not the customer is on it", () => {
    const serps = [ok(["customer.com", "rival-a.com"]), ok(["rival-b.com"]), missing()];
    const selected = [search("big", 900), search("small", 40), search("bigger but unread", 5000)];
    const card = buildPresenceCard({ serps, selected, ownDomain: "customer.com", rivals: [candidate("rival-a.com")] });
    expect(card.mostSearched).toEqual({ keyword: "big", volume: 900, topHolder: "customer.com" });
  });

  it("card/most-searched — absent where nothing was measured", () => {
    const card = buildPresenceCard({ serps: [missing()], selected: [search("q", 1)], ownDomain: "customer.com", rivals: [] });
    expect(card.mostSearched).toBeUndefined();
  });
});

describe('REQ-008 c4 — "up to five of the biggest are listed, each with its monthly volume and the domain currently holding the top position"', () => {
  it("card/absent-from-top-five-by-volume — seven absences return five, biggest volume first", () => {
    const volumes = [10, 70, 30, 50, 20, 60, 40];
    const serps = volumes.map(() => ok(["holder.com", "other.com"]));
    const selected = volumes.map((volume, i) => search(`q${i}`, volume));
    const card = buildPresenceCard({ serps, selected, ownDomain: "customer.com", rivals: [] });

    expect(card.absentFrom).toHaveLength(ABSENT_FROM_MAX);
    expect(card.absentFrom.map((a) => a.volume)).toEqual([70, 60, 50, 40, 30]);
    expect(card.absentFrom[0]).toEqual({ keyword: "q1", volume: 70, topHolder: "holder.com" });
  });

  it("card/absent-from-top-five-by-volume — a search whose top position is a platform returns topHolder: null", () => {
    const card = buildPresenceCard({
      serps: [ok(["reddit.com", "holder.com"])],
      selected: [search("q", 900)],
      ownDomain: "customer.com",
      rivals: [],
    });
    expect(card.absentFrom).toEqual([{ keyword: "q", volume: 900, topHolder: null }]);
  });

  it("card/absent-from-top-five-by-volume — an unmeasured search is neither an absence nor a presence", () => {
    const card = buildPresenceCard({
      serps: [missing(), ok(["holder.com"])],
      selected: [search("unmeasured", 9999), search("measured", 5)],
      ownDomain: "customer.com",
      rivals: [],
    });
    expect(card.absentFrom.map((a) => a.keyword)).toEqual(["measured"]);
    expect(card.measuredSearches).toBe(1);
  });

  it("card/absent-from-excludes-searches-the-customer-holds", () => {
    const card = buildPresenceCard({
      serps: [ok(["www.customer.com"]), ok(["holder.com"])],
      selected: [search("held", 500), search("absent", 400)],
      ownDomain: "customer.com",
      rivals: [],
    });
    expect(card.absentFrom.map((a) => a.keyword)).toEqual(["absent"]);
  });
});

describe('REQ-008 c5 — fewer than five rivals, and none, are card states, not errors', () => {
  it("card/framing-states — three rivals is `shown`; zero is `suppressed_no_rivals` and the card is still returned in full", () => {
    const { serps, selected } = twelve();
    const three = buildPresenceCard({
      serps,
      selected,
      ownDomain: "customer.com",
      rivals: [candidate("a.com"), candidate("b.com"), candidate("c.com")],
    });
    expect(three.rivals).toHaveLength(3);
    expect(three.framing).toBe("shown");

    const none = buildPresenceCard({ serps, selected, ownDomain: "customer.com", rivals: [] });
    expect(none.framing).toBe("suppressed_no_rivals");
    expect(none.measuredSearches).toBe(12);
    expect(none.you.top10Count).toBe(2);
    expect(none.absentFrom.length).toBeGreaterThan(0);
  });
});

describe('REQ-008 c6 and c10 — the card has nowhere to put a severity, a size or an unmeasured claim', () => {
  const card = buildPresenceCard({
    serps: [ok(["rival.com"])],
    selected: [search("q", 1)],
    ownDomain: "customer.com",
    rivals: [candidate("rival.com")],
  });

  it("card/no-severity-field — each rival entry's keys are exactly domain and top10Count", () => {
    for (const rival of card.rivals) expect(Object.keys(rival).sort()).toEqual(["domain", "top10Count"]);
  });

  it("card/no-field-for-an-unmeasured-claim — no size, money, severity or ranked-count key anywhere on the card", () => {
    const keys = new Set<string>();
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (typeof value === "object" && value !== null) {
        for (const [k, v] of Object.entries(value)) {
          keys.add(k);
          walk(v);
        }
      }
    };
    walk(card);
    for (const forbidden of [
      "rankedCount",
      "size",
      "band",
      "revenue",
      "trafficValue",
      "funding",
      "headcount",
      "customers",
      "projectedReturn",
      "severity",
      "warning",
      "level",
      "status",
      "problem",
      "ratio",
      "share",
      "percentage",
    ]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("card/no-field-for-an-unmeasured-claim — the module resolves no import into sizing or vendors", () => {
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*market\/sizing/);
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*lib\/vendors/);
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*lib\/costs/);
    expect(SOURCE).not.toMatch(/from\s+["'][^"']*lib\/llm/);
    expect(SOURCE).not.toMatch(/CostContext/);
  });
});

describe("The market-total volume footnote, removed by the owner on 2026-09-03 — both halves", () => {
  it("card/no-market-total-volume — no card-level sum field exists", () => {
    const card = buildPresenceCard({ serps: [ok([])], selected: [search("q", 1)], ownDomain: "c.com", rivals: [] });
    for (const forbidden of ["totalMonthlyVolume", "totalVolume", "marketVolume", "volumeTotal"]) {
      expect(Object.keys(card)).not.toContain(forbidden);
    }
  });

  it("card/no-market-total-volume — no value the card returns equals the sum of the selected volumes", () => {
    const volumes = [11, 13, 17, 19];
    const total = volumes.reduce((a, b) => a + b, 0);
    const card = buildPresenceCard({
      serps: volumes.map(() => ok(["holder.com"])),
      selected: volumes.map((v, i) => search(`q${i}`, v)),
      ownDomain: "customer.com",
      rivals: [],
    });

    const numbers: number[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === "number") numbers.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (typeof value === "object" && value !== null) Object.values(value).forEach(walk);
    };
    walk({ ...card, absentFrom: card.absentFrom.map((a) => ({ topHolder: a.topHolder, keyword: a.keyword })) });
    expect(numbers).not.toContain(total);
  });

  it("presence.ts contains no sum over the selected volumes", () => {
    expect(SOURCE).not.toMatch(/reduce\s*\(/);
  });
});

describe("Determinism, and the locale the whole card comes from", () => {
  it("card/byte-identical-on-every-run — 50 runs, and the pairs shuffled together, agree exactly", () => {
    const volumes = [40, 10, 40, 30, 20];
    const pairs = volumes.map((volume, i) => ({
      serp: ok([`holder-${i}.com`]),
      search: search(`k${i}`, volume),
    }));
    const build = (order: typeof pairs): PresenceCard =>
      buildPresenceCard({
        serps: order.map((p) => p.serp),
        selected: order.map((p) => p.search),
        ownDomain: "customer.com",
        rivals: [],
      });

    const first = JSON.stringify(build(pairs));
    for (let i = 0; i < 50; i += 1) expect(JSON.stringify(build(pairs))).toBe(first);
    expect(JSON.stringify(build([...pairs].reverse()))).toBe(first);
  });

  it("card/no-locale-parameter — the argument object has exactly four keys, none of them a locale", () => {
    const signature = SOURCE.slice(SOURCE.indexOf("export function buildPresenceCard"));
    const args = signature.slice(0, signature.indexOf("}): PresenceCard"));
    expect(args).not.toMatch(/locale|country|language/i);
    expect(args.match(/^\s{2}\w+:/gm)?.map((s) => s.trim().replace(":", ""))).toEqual([
      "serps",
      "selected",
      "ownDomain",
      "rivals",
    ]);
  });
});

describe("Observability — the framing state, and nothing else", () => {
  it("card/logs-framing-only", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    buildPresenceCard({ serps: [ok(["rival.com"])], selected: [search("secret keyword", 1)], ownDomain: "customer.com", rivals: [] });
    const line = spy.mock.calls.at(-1)?.[0] as string;
    expect(JSON.parse(line)).toEqual({ event: "presence_card", framing: "suppressed_no_rivals" });
    expect(line).not.toContain("secret keyword");
  });
});

describe("D67, owner ruling 2026-10-15 (issue 1441) — the local pack counts as the top ten", () => {
  it("the site in a search's local pack holds that search, and so does a rival there", () => {
    const local: MarketSerp = { ...serp(["directory.com"]), localPack: [{ domain: "www.customer.com" }, { domain: "rival-a.com" }] };
    const card = buildPresenceCard({
      serps: [measured(local, AT), ok(["directory.com"])],
      selected: [search("plumber leeds", 900), search("emergency plumber leeds", 300)],
      ownDomain: "customer.com",
      rivals: [candidate("rival-a.com")],
    });
    expect(card.you.top10Count).toBe(1);
    expect(card.rivals).toEqual([{ domain: "rival-a.com", top10Count: 1 }]);
    expect(card.absentFrom.map((a) => a.keyword)).toEqual(["emergency plumber leeds"]);
  });
});

describe("who is first is a business, never a source", () => {
  const first = (row: { domain: string; url?: string; title?: string }, more: Partial<Parameters<typeof buildPresenceCard>[0]> = {}) =>
    buildPresenceCard({
      serps: [measured({ organic: [{ position: 1, ...row }], aiOverview: { present: false, referenceDomains: [] } }, AT)],
      selected: [search("q", 900)],
      ownDomain: "customer.com",
      rivals: [],
      ...more,
    }).absentFrom[0]?.topHolder;

  it("names no public body, job page, article or stored source at position 1", () => {
    expect(first({ domain: "www.yourcareer.gov.au", title: "Bakers" })).toBeNull();
    expect(first({ domain: "bakingcareer.com.au", title: "Baking Career - Everything you need to know" })).toBeNull();
    expect(first({ domain: "eater.co.uk", title: "10 best bakeries in Leeds" })).toBeNull();
    expect(first({ domain: "guide.co.uk", title: "Bakeries" }, { sources: ["guide.co.uk"] })).toBeNull();
    expect(first({ domain: "www.brumbys.com.au", title: "Fresh bread" })).toBe("brumbys.com.au");
  });

  it("names a rival's list of others, as the rival holds the search", () => {
    const row = { domain: "rival.co.uk", url: "https://rival.co.uk/top-10-agencies", title: "Top 10 agencies to hire" };
    expect(first(row)).toBeNull();
    expect(first(row, { rivals: [candidate("rival.co.uk")] })).toBe("rival.co.uk");
  });
});

describe("a search whose top ten hides its holders behind Google redirects", () => {
  const stored = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "fixtures/au-baker-d149c119.json"), "utf8")) as { organic: MarketSerp["organic"] };
  const bakerSerp: MarketSerp = { organic: stored.organic, aiOverview: { present: false, referenceDomains: [] } };
  const baker = measured(bakerSerp, AT);

  it("stored AU baker top ten (d149c119): baker is not among the searches the customer does not show up on", () => {
    const card = buildPresenceCard({
      serps: [baker, ok(["rival-a.com"])],
      selected: [search("baker", 9900), search("bread", 100)],
      ownDomain: "bakersdelight.com.au",
      rivals: [candidate("rival-a.com")],
    });
    expect(card.absentFrom.map((row) => row.keyword)).toEqual(["bread"]);
    expect(card.measuredSearches).toBe(1);
    expect(card.you.top10Count).toBe(0);
  });

  it("a resolved row of the customer's still counts as present", () => {
    const shown = measured<MarketSerp>({ ...bakerSerp, organic: [...stored.organic, { position: 9, domain: "www.bakersdelight.com.au" }] }, AT);
    const card = buildPresenceCard({ serps: [shown], selected: [search("baker", 9900)], ownDomain: "bakersdelight.com.au", rivals: [] });
    expect(card.you.top10Count).toBe(1);
    expect(card.mostSearched?.topHolder).toBeNull();
  });
});
