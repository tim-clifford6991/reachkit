// tests/market/rivals/suggest.test.ts — BUILD §6.6
//
// Which source each market card reaches for, what it never spends, and the
// bound that stops setup ever waiting on a suggestion. `competitorsDomain`
// is stubbed at the vendor seam; no network, and the clock is injected.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { BATTERY, TIMING } from "../../../src/lib/config/constants.ts";
import type { CostContext } from "../../../src/lib/costs/index.ts";
import type { Measured } from "../../../src/lib/measure/measured.ts";
import type { CompetitorRow } from "../../../src/lib/vendors/dataforseo/types.ts";
import { initialSetupState, onMarketStated, type ReportFacts, type SetupState } from "../../../src/lib/market/setup/state.ts";
import { addRival } from "../../../src/lib/market/setup/rivals.ts";
import { codeOf, importsOf } from "./source.ts";

const { competitorsMock } = vi.hoisted(() => ({ competitorsMock: vi.fn() }));
vi.mock("@/lib/vendors/dataforseo", () => ({ competitorsDomain: competitorsMock }));

let suggestRivals: typeof import("../../../src/lib/market/rivals/suggest.ts").suggestRivals;

const AT = new Date("2026-09-06T00:00:00.000Z");

beforeEach(async () => {
  competitorsMock.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  ({ suggestRivals } = await import("../../../src/lib/market/rivals/suggest.ts"));
});

function report(a: { rivals?: readonly string[]; category?: string | null } = {}): ReportFacts {
  return {
    scanId: "scan-1",
    category: a.category === undefined ? "project management software" : a.category,
    rivals: a.rivals ?? ["one.com", "two.com"],
    questions: [],
    derivable: null,
  };
}

/** A card whose market a report inferred. */
function inferred(a: { rivals?: readonly string[] } = {}): { state: SetupState; report: ReportFacts } {
  const facts = report(a);
  return { state: initialSetupState({ domain: "customer.com", report: facts }), report: facts };
}

/** A card whose market the founder stated, with no report behind it. */
function stated(): SetupState {
  const base = initialSetupState({ domain: "customer.com", report: report({ category: null }) });
  return onMarketStated(base, "project management software");
}

function competitors(domains: readonly string[]): Measured<CompetitorRow[]> {
  const value = domains.map((domain) => ({ domain, overlapKeywords: 5 }));
  return domains.length === 0 ? { kind: "zero", value, at: AT } : { kind: "measured", value, at: AT };
}

function fakeCostContext(): CostContext {
  return {
    cap: "DEEP",
    async recordFetch() {
      throw new Error("suggestRivals must reach the vendor through competitorsDomain(), never recordFetch directly");
    },
    capHit: () => false,
    spentCents: () => 0,
    degraded: () => false,
  };
}

describe('REQ-026 c7 — "it offers suggested rivals drawn from that market"', () => {
  it("suggestRivals/inferred-path-uses-the-report — the report's own derivation, and zero vendor calls", async () => {
    const { state, report: facts } = inferred({ rivals: ["one.com", "two.com"] });
    const out = await suggestRivals(fakeCostContext(), { state, report: facts, at: AT });

    expect(out).toEqual({ kind: "measured", value: ["one.com", "two.com"], at: AT });
    expect(competitorsMock).not.toHaveBeenCalled();
  });

  it("suggestRivals/stated-path-uses-competitors-domain — exactly one call, on the address the account will use", async () => {
    competitorsMock.mockResolvedValue(competitors(["rival.com"]));
    const out = await suggestRivals(fakeCostContext(), { state: stated(), report: null, at: AT });

    expect(competitorsMock).toHaveBeenCalledTimes(1);
    expect(competitorsMock).toHaveBeenCalledWith(expect.anything(), { domain: "customer.com" });
    expect(out).toEqual({ kind: "measured", value: ["rival.com"], at: AT });
  });

  it("suggestRivals/at-most-one-call — 0 calls on the empty card, 0 on the inferred one, 1 on the stated one", async () => {
    const empty = initialSetupState(null);
    competitorsMock.mockResolvedValue(competitors([]));

    await suggestRivals(fakeCostContext(), { state: empty, report: null, at: AT });
    expect(competitorsMock).toHaveBeenCalledTimes(0);

    const { state, report: facts } = inferred();
    await suggestRivals(fakeCostContext(), { state, report: facts, at: AT });
    expect(competitorsMock).toHaveBeenCalledTimes(0);

    await suggestRivals(fakeCostContext(), { state: stated(), report: null, at: AT });
    expect(competitorsMock).toHaveBeenCalledTimes(1);
  });

  it("suggestRivals/candidates-are-admissible — canonical, de-duplicated, never the account's own address, never one already held", async () => {
    const { state, report: facts } = inferred({
      rivals: [
        "https://www.One.com/pricing", // canonicalises onto one.com
        "one.com",
        "www.customer.com", // the account's own address
        "not a domain",
        "held.com",
        "three.com",
      ],
    });
    const added = addRival(state.rivals, {
      domain: "held.com",
      origin: "typed",
      ownDomain: "customer.com",
      resolves: true,
    });
    if (!added.ok) throw new Error("fixture: held.com should have been addable");

    const out = await suggestRivals(fakeCostContext(), {
      state: { ...state, rivals: added.set },
      report: facts,
      at: AT,
    });
    expect(out).toEqual({ kind: "measured", value: ["one.com", "three.com"], at: AT });
  });

  it("suggestRivals/never-offers-more-than-the-set-holds", async () => {
    const many = Array.from({ length: BATTERY.COMPETITORS_MAX + 4 }, (_, i) => `r${i}.com`);
    const { state, report: facts } = inferred({ rivals: many });
    const out = await suggestRivals(fakeCostContext(), { state, report: facts, at: AT });

    expect(out.kind).toBe("measured");
    if (out.kind !== "unmeasured") expect(out.value).toHaveLength(BATTERY.COMPETITORS_MAX);
  });

  it("suggestRivals/replaced-market-rivals-never-offered — a market the founder stated is not the report's market", async () => {
    competitorsMock.mockResolvedValue(competitors(["vendor-said.com"]));
    const facts = report({ rivals: ["from-the-report.com"] });
    const state = onMarketStated(initialSetupState({ domain: "customer.com", report: facts }), "something else");

    const out = await suggestRivals(fakeCostContext(), { state, report: facts, at: AT });
    expect(out.kind === "unmeasured" ? [] : out.value).toEqual(["vendor-said.com"]);
  });
});

describe('REQ-026 c10 — "it says it is waiting on their market, never that no rivals were found"', () => {
  it("suggestRivals/empty-market-makes-no-call — nothing sought, and the arm says so", async () => {
    const out = await suggestRivals(fakeCostContext(), { state: initialSetupState(null), report: null, at: AT });

    expect(out).toEqual({ kind: "unmeasured", reason: "not_attempted", at: AT });
    expect(competitorsMock).not.toHaveBeenCalled();
  });

  it("suggestRivals/sought-and-nothing-came-back — a call was made and the answer was none", async () => {
    competitorsMock.mockResolvedValue(competitors([]));
    const out = await suggestRivals(fakeCostContext(), { state: stated(), report: null, at: AT });

    expect(competitorsMock).toHaveBeenCalledTimes(1);
    expect(out).toEqual({ kind: "zero", value: [], at: AT });
  });

  it("suggestRivals/cold-start-is-an-empty-answer-not-an-error — a domain that ranks for nothing has no competitors to return", async () => {
    competitorsMock.mockResolvedValue({ kind: "zero", value: [], at: AT });
    const out = await suggestRivals(fakeCostContext(), { state: stated(), report: null, at: AT });
    expect(out.kind).toBe("zero");
  });
});

describe("BP-034 NFR budget — setup is never held on suggestions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("suggestRivals/timeout-releases-setup — a call that never resolves is abandoned at the ceiling", async () => {
    vi.useFakeTimers();
    competitorsMock.mockReturnValue(new Promise(() => {}));

    const pending = suggestRivals(fakeCostContext(), { state: stated(), report: null, at: AT });
    await vi.advanceTimersByTimeAsync(TIMING.suggestCeilingS * 1000);

    await expect(pending).resolves.toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
  });

  it("suggestRivals/vendor-failure-releases-setup — the reason survives and the promise never rejects", async () => {
    competitorsMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    await expect(
      suggestRivals(fakeCostContext(), { state: stated(), report: null, at: AT })
    ).resolves.toEqual({ kind: "unmeasured", reason: "undeterminable", at: AT });
  });

  it("suggestRivals/the-ceiling-is-the-pin — the seconds are read from TIMING, not written here", () => {
    expect(codeOf("suggest.ts")).toContain("TIMING.suggestCeilingS");
    expect(codeOf("suggest.ts")).not.toMatch(/[^\w.]3000[^\w]/);
  });
});

describe("§6.6 — the report path buys nothing, and no market is re-inferred", () => {
  it("suggestRivals/reaches-no-model — nothing in this module can re-infer a market", () => {
    expect(importsOf("suggest.ts").filter((i) => i.includes("/llm"))).toEqual([]);
    expect(codeOf("suggest.ts")).not.toContain("deriveProfile");
  });
});
