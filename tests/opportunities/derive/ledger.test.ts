// One pass's new-page supply, per source: what each stage kept, what the site holds after, and which sources ran dry.
import { describe, expect, it } from "vitest";
import { PLAN_DEPTH, TOPIC_FIT } from "../../../src/lib/config/constants";
import { ledgerSourceOf, supplyLedger } from "../../../src/lib/opportunities/derive/ledger";

const open = (n: number, over: { family?: "write" | "earn" | "improve"; status?: "open" | "queued" | "dismissed"; businessFit?: 1 | 2 | 3 | null } = {}) =>
  Array.from({ length: n }, () => ({ family: over.family ?? "write", status: over.status ?? "open", businessFit: over.businessFit ?? null }) as const);

describe("supplyLedger", () => {
  it("counts each source at each stage, and names every source that added nothing", () => {
    const ledger = supplyLedger({
      stages: {
        offered: ["product", "product", "problem", "asked", "written", "written"],
        searched: ["product", "product", "asked", "written"],
        fit: ["product", "asked"],
        candidates: ["product", "asked"],
        added: ["product"],
      },
      rows: [...open(3), ...open(2, { family: "earn", businessFit: TOPIC_FIT.writeAt })],
    });
    expect(ledger.sources.product).toEqual({ offered: 2, searched: 2, fit: 1, candidates: 1, added: 1 });
    expect(ledger.sources.written).toEqual({ offered: 2, searched: 1, fit: 0, candidates: 0, added: 0 });
    expect(ledger.sources.asked).toEqual({ offered: 1, searched: 1, fit: 1, candidates: 1, added: 0 });
    expect(ledger.sources.problem).toEqual({ offered: 1, searched: 0, fit: 0, candidates: 0, added: 0 });
    expect(ledger.have).toBe(5);
    expect(ledger.short).toBe(PLAN_DEPTH - 5);
    expect(ledger.dry).toEqual(["problem", "category", "best_x", "ai_gap", "asked", "cited", "written"]);
  });

  it("holds only open new-page rows the fit judgement did not keep below the top", () => {
    const ledger = supplyLedger({
      stages: {},
      rows: [...open(1), ...open(1, { family: "improve" }), ...open(1, { status: "queued" }), ...open(1, { status: "dismissed" }), ...open(1, { businessFit: TOPIC_FIT.gate })],
    });
    expect(ledger.have).toBe(1);
  });

  it("a site holding a week and its spares is short of nothing, and its dry sources are still named", () => {
    const ledger = supplyLedger({ stages: { added: ["category"] }, rows: open(PLAN_DEPTH + 2) });
    expect(ledger.short).toBe(0);
    expect(ledger.dry).toEqual(["product", "problem", "best_x", "ai_gap", "asked", "cited", "written"]);
  });
});

describe("ledgerSourceOf", () => {
  it("names where the topic came from before what it is about", () => {
    expect(ledgerSourceOf({ source: "product", cited: "https://rival.example/page" })).toBe("cited");
    expect(ledgerSourceOf({ source: "problem", asked: { term: "x", serpAt: new Date(0) } })).toBe("asked");
    expect(ledgerSourceOf({ source: "best_x", written: true })).toBe("written");
    expect(ledgerSourceOf({ source: "ai_gap" })).toBe("ai_gap");
    expect(ledgerSourceOf({ source: null })).toBe("category");
  });
});
