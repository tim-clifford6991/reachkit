// evaluateAcceptance — what a week can and cannot decide, and the two
// causes it may name.
//
// The cases that discriminate are the negative ones: no input to this
// function produces `page_not_found`, `unpublished` or `domain_changed`.
// A positive-only suite is green either way, and the branch that guesses
// one of the three from a missing measurement retires a live page forever
// (ADR-072 decision 5, ADR-085).
import { describe, expect, it } from "vitest";
import { evaluateAcceptance as evaluate } from "../../../src/lib/opportunities/verdicts/evaluate";
import type { Acceptance } from "../../../src/lib/opportunities/types";
import type { WeekMeasurements } from "../../../src/lib/opportunities/verdicts/types";
import type { SearchRows } from "../../../src/lib/measure/page-reading";
import { measured, measuredZero, unmeasured } from "../../../src/lib/measure/measured";
import type { Barrier } from "../../../src/lib/opportunities/types";
import type { Measured } from "../../../src/lib/measure/measured";
import { AT, DOMAIN } from "../fixtures";

const WEEK = "2026-08-31";
const PAGE = `https://${DOMAIN}/guides/p`;

/** A read SERP holding this page at `position`, or not holding it. */
function serpWith(position: number | null): Measured<SearchRows> {
  return measured({ serp: position === null ? [] : [{ url: PAGE, position }], ranked: [], complete: true }, AT);
}

/** Every case here judges the one page. */
function evaluateAcceptance(a: { acceptance: Acceptance; week: WeekMeasurements; pageUrl?: string; search?: string }) {
  return evaluate({ pageUrl: PAGE, ...a });
}

function week(over: Partial<WeekMeasurements> = {}): WeekMeasurements {
  return {
    week: WEEK,
    measuredAt: AT,
    domain: DOMAIN,
    positions: new Map<string, Measured<SearchRows>>(),
    namesCustomer: new Map<string, Measured<boolean>>(),
    ownPagesCited: new Map<string, Measured<readonly string[]>>(),
    promptCitations: new Map<string, Measured<readonly string[]>>(),
    gatesCleared: new Map<Barrier, Measured<boolean>>(),
    siteIssues: null,
    ...over,
  };
}

describe("top20 — the customer's own place for the recorded search", () => {
  it("a measured place decides the test and passes it", () => {
    const out = evaluateAcceptance({
      acceptance: { form: "top20", query: "q" },
      week: week({ positions: new Map([["q", serpWith(4)]]) }),
    });
    expect(out).toEqual({ decided: true, passes: true, measuredAt: AT });
  });

  it("a measured zero — the SERP was read and the customer holds no place — decides it and fails it", () => {
    const out = evaluateAcceptance({
      acceptance: { form: "top20", query: "q" },
      week: week({ positions: new Map([["q", serpWith(null)]]) }),
    });
    expect(out).toEqual({ decided: true, passes: false, measuredAt: AT });
  });

  it("a search the week no longer measures at all returns search_untracked — an absent key, never an unmeasured value", () => {
    expect(evaluateAcceptance({ acceptance: { form: "top20", query: "q" }, week: week() })).toEqual({
      decided: false,
      cause: "search_untracked",
    });
  });

  it("a search still tracked whose SERP the week could not read is not_measured, and is never a cause", () => {
    const out = evaluateAcceptance({
      acceptance: { form: "top20", query: "q" },
      week: week({ positions: new Map([["q", unmeasured<SearchRows>("undeterminable", AT)]]) }),
    });
    // The distinction this whole subsystem exists to keep: one missed
    // request is a week's miss, not a page retired forever.
    expect(out).toEqual({ decided: false, because: "not_measured" });
  });
});

describe("named_on — whether this week's AI answer to the page's question cites the page", () => {
  const cited = (urls: Measured<readonly string[]>) => week({ ownPagesCited: new Map([["p", urls]]) });
  const acceptance = { form: "named_on", question: "p" } as const;

  it("an answer that cites the page passes it, however the address was written", () => {
    expect(
      evaluateAcceptance({ acceptance, week: cited(measured([`https://www.${DOMAIN}/guides/p/?utm_source=ai#:~:text=x`], AT)) })
    ).toEqual({ decided: true, passes: true, measuredAt: AT });
  });

  it("an answer that names the site and cites another of its pages does not credit this one", () => {
    expect(
      evaluateAcceptance({
        acceptance,
        week: week({
          namesCustomer: new Map([["p", measured(true, AT)]]),
          ownPagesCited: new Map([["p", measured([`https://${DOMAIN}/`], AT)]]),
        }),
      })
    ).toEqual({ decided: true, passes: false, measuredAt: AT });
  });

  it("an answer that cited none of the site's pages fails it", () => {
    expect(evaluateAcceptance({ acceptance, week: cited(measuredZero<readonly string[]>([], AT)) })).toEqual({
      decided: true,
      passes: false,
      measuredAt: AT,
    });
  });

  it("an answer whose addresses were not read decides nothing", () => {
    expect(
      evaluateAcceptance({ acceptance, week: cited(unmeasured<readonly string[]>("undeterminable", AT)) })
    ).toEqual({ decided: false, because: "not_measured" });
  });

  it("a question this week did not ask is not_measured, never a cause", () => {
    expect(evaluateAcceptance({ acceptance, week: week() })).toEqual({ decided: false, because: "not_measured" });
  });
});

describe("named_on — a place in the top twenty of the page's target search also passes it", () => {
  const acceptance = { form: "named_on", question: "p" } as const;
  const placed = (position: number | null, urls?: Measured<readonly string[]>) =>
    week({
      positions: new Map([["t", serpWith(position)]]),
      ownPagesCited: urls === undefined ? new Map() : new Map([["p", urls]]),
    });

  it("a page at 14 on its target passes, whether its question was asked or its answer cited another page", () => {
    const passes = { decided: true, passes: true, measuredAt: AT };
    expect(evaluateAcceptance({ acceptance, week: placed(14), search: "t" })).toEqual(passes);
    expect(
      evaluateAcceptance({ acceptance, week: placed(14, measuredZero<readonly string[]>([], AT)), search: "t" })
    ).toEqual(passes);
  });

  it("a place past twenty passes nothing: the answer still decides, and an unasked question stays not measured", () => {
    expect(
      evaluateAcceptance({ acceptance, week: placed(21, measuredZero<readonly string[]>([], AT)), search: "t" })
    ).toEqual({ decided: true, passes: false, measuredAt: AT });
    expect(evaluateAcceptance({ acceptance, week: placed(21), search: "t" })).toEqual({
      decided: false,
      because: "not_measured",
    });
  });

  it("without a target search the place is not read", () => {
    expect(evaluateAcceptance({ acceptance, week: placed(3) })).toEqual({ decided: false, because: "not_measured" });
  });
});

describe("gate_cleared — whether the barrier is cleared", () => {
  it("a measured gate decides it", () => {
    expect(
      evaluateAcceptance({
        acceptance: { form: "gate_cleared", gate: "noindex" },
        week: week({ gatesCleared: new Map<Barrier, Measured<boolean>>([["noindex", measured(true, AT)]]) }),
      })
    ).toEqual({ decided: true, passes: true, measuredAt: AT });
  });

  it("a barrier absent from the week's gates is undecided rather than failing — and names no cause", () => {
    // A barrier belongs to a closed set and cannot leave a tracked set, so
    // an absent key here is a gate the week did not look at.
    expect(
      evaluateAcceptance({ acceptance: { form: "gate_cleared", gate: "js_only" }, week: week() })
    ).toEqual({ decided: false, because: "not_measured" });
  });
});

describe("the three causes this function must never produce", () => {
  const forms = [
    { form: "top20", query: "q" },
    { form: "named_on", question: "p" },
    { form: "gate_cleared", gate: "noindex" as Barrier },
  ] as const;

  const readings: Measured<never>[] | Measured<number>[] = [
    measured(1, AT),
    measuredZero(0, AT),
    unmeasured<number>("undeterminable", AT),
    unmeasured<number>("not_attempted", AT),
  ];

  it("an exhaustive sweep of the fixture space never returns page_not_found, unpublished or domain_changed", () => {
    const seen = new Set<string>();
    for (const acceptance of forms) {
      for (const present of [false, true]) {
        for (const reading of readings) {
          const key = "q";
          const positions = new Map<string, Measured<SearchRows>>();
          const namesCustomer = new Map<string, Measured<boolean>>();
          const gatesCleared = new Map<Barrier, Measured<boolean>>();
          if (present) {
            positions.set(key, reading.kind === "unmeasured" ? reading : serpWith(reading.kind === "zero" ? null : reading.value));
            namesCustomer.set("p", reading.kind === "unmeasured" ? reading : measured(true, AT));
            gatesCleared.set("noindex", reading.kind === "unmeasured" ? reading : measured(true, AT));
          }
          const out = evaluateAcceptance({
            acceptance,
            week: week({ positions, namesCustomer, gatesCleared }),
          });
          if (!out.decided && "cause" in out) seen.add(out.cause);
        }
      }
    }
    expect([...seen].sort()).toEqual(["search_untracked"]);
    expect(seen.has("page_not_found")).toBe(false);
    expect(seen.has("unpublished")).toBe(false);
    expect(seen.has("domain_changed")).toBe(false);
  });

  it("the recorded test is never rewritten — the module holds no write path to opportunities", () => {
    const acceptance = { form: "top20", query: "q" } as const;
    const before = JSON.stringify(acceptance);
    evaluateAcceptance({ acceptance, week: week() });
    expect(JSON.stringify(acceptance)).toBe(before);
  });
});
