// tests/app/overview/rivals.test.ts — BUILD §4.5 item 4, §6.6's cold-start law.
//
// §6.6, verbatim: "when the customer's count is 0, render the rivals'
// absolute numbers with `you: 0` — **never a ratio** (division by zero
// renders as ∞× and reads as broken). The ratio module unlocks at ranked ≥
// 10." Arm selection at 0, 9 and 10 is therefore the whole of this file,
// plus the two things the arms may not do: show an unconfirmed candidate,
// and describe a cold start as the gap shrinking.
import { describe, expect, it } from "vitest";
import { measured, measuredZero } from "@/lib/measure/measured";
import { RATIO_UNLOCK } from "@/lib/config/constants";
import {
  ABSOLUTE_LINE_KEY,
  resolveRivals,
  SHRINKING_LINE_KEY,
  type RivalFact,
  type RivalFacts,
} from "@/app/(account)/app/_overview/rivals";

const AT = new Date(Date.UTC(2026, 7, 31));
const PREV = new Date(Date.UTC(2026, 7, 24));

const rival = (over: Partial<RivalFact> = {}): RivalFact => ({
  domain: "bigcompetitor.com",
  confirmed: true,
  ranked: measured(800, AT),
  series: [276, 168, 78],
  ...over,
});

const facts = (own: number, over: Partial<RivalFacts> = {}): RivalFacts => ({
  own: own === 0 ? measuredZero(0, AT) : measured(own, AT),
  rivals: [rival()],
  ...over,
});

describe("arm selection", () => {
  it("at own = 0 the arm is absolute, and what moves is the rival's own count", () => {
    const gap = resolveRivals(facts(0));
    expect(gap.kind).toBe("absolute");
    if (gap.kind !== "absolute") return;
    expect(gap.own).toEqual(measuredZero(0, AT));
    expect(gap.rivals[0]?.ranked).toEqual(measured(800, AT));
    expect(gap.rivals[0]).not.toHaveProperty("ratio");
  });

  it("at own = 9 the arm is absolute and exposes no ratio field", () => {
    const gap = resolveRivals(facts(RATIO_UNLOCK - 1));
    expect(gap.kind).toBe("absolute");
    if (gap.kind !== "absolute") return;
    expect(JSON.stringify(gap)).not.toContain("ratio");
  });

  it("at own = 10 the arm is ratio", () => {
    const gap = resolveRivals(facts(RATIO_UNLOCK, { previousOwn: measured(RATIO_UNLOCK, PREV) }));
    expect(gap.kind).toBe("ratio");
  });

  it("the ratio it computes is the rival's count over the customer's", () => {
    const gap = resolveRivals(
      facts(10, {
        previousOwn: measured(10, PREV),
        rivals: [rival({ ranked: measured(780, AT), previousRanked: measured(2760, PREV) })],
      })
    );
    if (gap.kind !== "ratio") throw new Error("expected the ratio arm");
    expect(gap.rivals[0]?.ratio).toEqual(measured(78, AT));
  });
});

describe("the previous value on the ratio arm", () => {
  it("carries the previous ratio where one was taken", () => {
    const gap = resolveRivals(
      facts(10, {
        previousOwn: measured(10, PREV),
        rivals: [rival({ ranked: measured(780, AT), previousRanked: measured(2760, PREV) })],
      })
    );
    if (gap.kind !== "ratio") throw new Error("expected the ratio arm");
    expect(gap.rivals[0]?.previous).toEqual(measured(276, PREV));
  });

  it("crossing the threshold this week carries first_ratio with that measurement's counts", () => {
    const previousOwn = measured(RATIO_UNLOCK - 1, PREV);
    const previousRanked = measured(2760, PREV);
    const gap = resolveRivals(
      facts(RATIO_UNLOCK, { previousOwn, rivals: [rival({ previousRanked })] })
    );
    if (gap.kind !== "ratio") throw new Error("expected the ratio arm");
    expect(gap.rivals[0]?.previous).toEqual({
      kind: "first_ratio",
      counts: { own: previousOwn, rival: previousRanked },
    });
  });

  it("with no previous measurement at all it is first_ratio, never a computed one", () => {
    const gap = resolveRivals(facts(RATIO_UNLOCK));
    if (gap.kind !== "ratio") throw new Error("expected the ratio arm");
    const previous = gap.rivals[0]?.previous;
    expect(previous && "kind" in previous && previous.kind).toBe("first_ratio");
  });
});

describe("what the module may not do", () => {
  it("a derived-but-unconfirmed candidate never appears, in either arm", () => {
    const candidate = rival({ domain: "unconfirmed.com", confirmed: false });
    const cold = resolveRivals(facts(0, { rivals: [rival(), candidate] }));
    const warm = resolveRivals(
      facts(RATIO_UNLOCK, { previousOwn: measured(RATIO_UNLOCK, PREV), rivals: [rival(), candidate] })
    );
    for (const gap of [cold, warm]) {
      expect(gap.rivals.map((r) => r.domain)).toEqual(["bigcompetitor.com"]);
    }
  });

  it("the cold-start arm's line is not the gap-shrinking line", () => {
    const gap = resolveRivals(facts(0));
    expect(gap.lineKey).toBe(ABSOLUTE_LINE_KEY);
    expect(gap.lineKey).not.toBe(SHRINKING_LINE_KEY);
  });

  it("the ratio arm does state the gap-shrinking line", () => {
    const gap = resolveRivals(facts(RATIO_UNLOCK, { previousOwn: measured(RATIO_UNLOCK, PREV) }));
    expect(gap.lineKey).toBe(SHRINKING_LINE_KEY);
  });

  it("every confirmed competitor keeps its name and its movement", () => {
    const second = rival({ domain: "secondplace.io", series: [94, 63, 31] });
    const gap = resolveRivals(facts(0, { rivals: [rival(), second] }));
    if (gap.kind !== "absolute") throw new Error("expected the absolute arm");
    expect(gap.rivals.map((r) => r.domain)).toEqual(["bigcompetitor.com", "secondplace.io"]);
    expect(gap.rivals[1]?.series).toEqual([94, 63, 31]);
  });
});

// ── REQ-096 c6 — the swap offer, on both arms (issue #223) ─────────────
//
// The rows that discriminate are the negative ones. `swapOffer` already
// decides "far, and only far"; what this resolver can get wrong is *which
// rivals it asks about* and *which arms it asks on* — and both mistakes
// look like nothing at all on a screen until a customer with a far rival
// is never offered the one control REQ-096 c6 promises them.
const sized = (band: "near" | "middle" | "far", domain = "bigcompetitor.com") =>
  ({ domain, state: "sized" as const, rankedCount: 6318, band, at: AT, current: true });

describe("the offer follows the band, and the band alone", () => {
  it("a rival banded far carries the offer, naming itself and the competitors card", () => {
    const gap = resolveRivals(facts(81, { rivals: [rival({ size: sized("far") })] }));
    expect(gap.rivals[0]?.offer).toEqual({
      offered: true,
      rival: "bigcompetitor.com",
      destination: "settings.competitors",
    });
  });

  it.each(["near", "middle"] as const)("a rival banded %s carries none", (band) => {
    const gap = resolveRivals(facts(81, { rivals: [rival({ size: sized(band) })] }));
    expect(gap.rivals[0]?.offer).toEqual({ offered: false });
  });

  it("a rival the week did not size carries none — an unsized rival has no band to be far", () => {
    const gap = resolveRivals(
      facts(81, {
        rivals: [
          rival({
            size: { domain: "bigcompetitor.com", state: "unsized", because: "awaiting_deep_pass" },
          }),
        ],
      })
    );
    expect(gap.rivals[0]?.offer).toEqual({ offered: false });
  });

  it("a rival with no sizing at all carries none, and does not throw", () => {
    const gap = resolveRivals(facts(81, { rivals: [rival()] }));
    expect(gap.rivals[0]?.offer).toEqual({ offered: false });
  });
});

describe("**both arms** — a cold-start customer can have a rival beyond reach too", () => {
  it("the absolute arm carries the offer", () => {
    // Reading c6 as a warm-arm rule would withhold the one control from
    // exactly the customers likeliest to need it: the ones whose own count
    // has not passed the unlock.
    const gap = resolveRivals(facts(0, { rivals: [rival({ size: sized("far") })] }));
    expect(gap.kind).toBe("absolute");
    expect(gap.rivals[0]?.offer).toMatchObject({ offered: true });
  });

  it("the ratio arm carries it too, and the two arms agree", () => {
    const far = rival({ size: sized("far") });
    const cold = resolveRivals(facts(0, { rivals: [far] }));
    const warm = resolveRivals(facts(RATIO_UNLOCK, { rivals: [far] }));
    expect(warm.kind).toBe("ratio");
    expect(warm.rivals[0]?.offer).toEqual(cold.rivals[0]?.offer);
  });
});

describe("REQ-096 c7 — an offer never narrows the set", () => {
  it("a far rival keeps its row, its figure and its place in the order", () => {
    const gap = resolveRivals(
      facts(81, {
        rivals: [
          rival({ domain: "near.example", size: sized("near", "near.example") }),
          rival({ domain: "far.example", size: sized("far", "far.example") }),
          rival({ domain: "middle.example", size: sized("middle", "middle.example") }),
        ],
      })
    );
    expect(gap.rivals.map((r) => r.domain)).toEqual([
      "near.example",
      "far.example",
      "middle.example",
    ]);
    expect(gap.rivals.filter((r) => r.offer.offered)).toHaveLength(1);
    // The far row is not stripped of anything the others carry.
    expect(gap.rivals[1]).toHaveProperty("ratio");
    expect(gap.rivals[1]?.series).toEqual([276, 168, 78]);
  });
});
