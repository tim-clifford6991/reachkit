// SPEC §6 (2026-10-09, issue 1365) — rivals are chosen from who the pass
// saw: the products on its measured first pages take the first places, and
// one it saw nowhere comes after every one it saw.
import "../../generate/env.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { byDemand } from "@/lib/market/infer/demand";
import type { MarketEvidence } from "@/lib/market/infer/evidence";
import { concludeRivals, RIVALS_SCHEMA } from "@/lib/market/infer/infer";
import { chooseRivals, seenByDomain, seenIn, type Seen } from "@/lib/market/infer/presence";
import { settleRivals } from "@/lib/market/infer/stability";
import { parseStoredMarket } from "@/lib/market/infer/stored";
import type { RivalConclusion } from "@/lib/market/infer/types";
import { marketEvidence } from "@/lib/scan/market-evidence";
import { readStoredReport } from "@/lib/scan/report";

function rival(name: string, volume: number, over: Partial<RivalConclusion> = {}): RivalConclusion {
  return { domain: `${name.toLowerCase()}.com`, name, basis: "same_job", reason: "", volume, ...over };
}

const seen = (rows: Record<string, [firstPage: number, named: number]>): Map<string, Seen> =>
  new Map(Object.entries(rows).map(([name, [firstPage, named]]) => [`${name.toLowerCase()}.com`, { firstPage, named }]));

const names = (rivals: readonly RivalConclusion[]): string[] => rivals.map((r) => r.name);

describe("what a pass wants", () => {
  // In D50's order, as `byDemand` hands them over.
  const FRESH = [
    rival("Famous", 6600),
    rival("Known", 2400),
    rival("Recalled", 900),
    rival("Quiet", 300),
    rival("Holder", 0),
    rival("Ranker", 0),
    rival("Third", 0),
  ];

  it("gives the first places to the products that hold the most first pages, whatever their brand", () => {
    const wanted = chooseRivals({
      fresh: FRESH,
      seen: seen({ Famous: [0, 6], Known: [0, 2], Quiet: [0, 1], Holder: [4, 0], Ranker: [2, 1], Third: [1, 0] }),
    });
    // Two such places, not three: the rest is still the market's known names.
    expect(names(wanted)).toEqual(["Holder", "Ranker", "Famous", "Known", "Quiet"]);
  });

  it("puts a candidate the pass saw nowhere after every one it saw", () => {
    const wanted = chooseRivals({ fresh: FRESH.slice(0, 5), seen: seen({ Famous: [0, 3], Quiet: [0, 1], Holder: [0, 1] }), max: 3 });
    expect(names(wanted)).toEqual(["Famous", "Quiet", "Holder"]);
  });

  it("keeps D50's order where the pass saw nobody, and where it read no evidence", () => {
    expect(names(chooseRivals({ fresh: FRESH, seen: new Map() }))).toEqual(["Famous", "Known", "Recalled", "Quiet", "Holder"]);
    expect(names(chooseRivals({ fresh: FRESH }))).toEqual(["Famous", "Known", "Recalled", "Quiet", "Holder"]);
  });

  it("never seats a product that does only part of the job for its first pages", () => {
    const fresh = [rival("Famous", 6600), rival("Poll", 110000, { closeness: "partial" })];
    expect(names(chooseRivals({ fresh, seen: seen({ Famous: [0, 2], Poll: [7, 0] }) }))).toEqual(["Famous", "Poll"]);
  });
});

describe("what the evidence shows of a candidate", () => {
  const evidence: MarketEvidence = {
    domain: "you.example",
    siteName: "You",
    headline: null,
    measuredUnder: null,
    pages: [],
    products: [],
    claims: [],
    ownSearches: [],
    topTens: [
      { domain: "www.profound.com", appearances: 2, title: "" },
      { domain: "blog.profound.com", appearances: 1, title: "" },
    ],
    answers: [
      { question: "q1", citedDomains: ["docs.profound.com"], namesSite: false },
      { question: "q2", citedDomains: [], namesSite: false, excerpt: "Tools such as Profound, and others." },
      { question: "q3", citedDomains: [], namesSite: false, excerpt: "A profound change in how buyers search." },
    ],
  };

  it("counts its first pages across its hosts, and an answer that cites it or says its name as a name", () => {
    expect(seenIn(evidence, { domain: "profound.com", name: "Profound" })).toEqual({ firstPage: 3, named: 2 });
    expect(seenIn(evidence, { domain: "other.com", name: "Other" })).toEqual({ firstPage: 0, named: 0 });
  });
});

describe("reachkit.app's pass 0e5c5228, from what production stored", () => {
  const snapshot = JSON.parse(readFileSync("scripts/pass/snapshot/0e5c5228.json", "utf8")) as {
    scan: { report: unknown };
    site: { market: unknown; competitors: string[] };
    fetches: { source: string; payload: { value: unknown } }[];
  };
  const evidence = marketEvidence({
    domain: "reachkit.app",
    siteName: "ReachKit",
    headline: null,
    pages: [],
    products: [],
    claims: [],
    report: readStoredReport(snapshot.scan.report),
  });
  const stored = parseStoredMarket(snapshot.site.market);
  // The pass's own last rival conclusion, as the model answered it.
  const answer = RIVALS_SCHEMA.parse(snapshot.fetches.filter((f) => f.source === "rival-inference").at(-1)!.payload.value);
  const candidates = concludeRivals(answer, evidence, 10);
  const fresh = byDemand(candidates, stored.current!.demand!);
  const seenHere = seenByDomain(evidence, candidates);

  it("none of the five it tracked held a first-page place, and two of its candidates did", () => {
    expect(snapshot.site.competitors.map((domain) => seenHere.get(domain)?.firstPage)).toEqual([0, 0, 0, 0, 0]);
    expect(candidates.filter((r) => (seenHere.get(r.domain)?.firstPage ?? 0) > 0).map((r) => r.name).sort()).toEqual(["Analyze AI", "Rankscale"]);
  });

  it("wants the two on its first pages with the three its answers name, and gets there in two passes", () => {
    expect(names(chooseRivals({ fresh, seen: seenHere }))).toEqual(["Analyze AI", "Rankscale", "Profound", "Peec AI", "Otterly"]);

    const first = settleRivals({ stored, standing: snapshot.site.competitors, fresh, seen: seenHere, scanId: "one", at: new Date("2026-10-12T06:00:00Z") });
    // D65: one pass's reading swaps nobody.
    expect(first.changed).toBe(false);
    expect(first.next.rivalsLeftOut).toEqual(["beomniscient.com", "mybrandi.ai"]);

    const second = settleRivals({ stored: first.next, standing: first.rivals, fresh, seen: seenHere, scanId: "two", at: new Date("2026-10-19T06:00:00Z") });
    expect([...second.rivals].sort()).toEqual(["otterly.ai", "peec.ai", "rankscale.ai", "tryanalyze.ai", "tryprofound.com"]);
  });
});
