// tests/generate/claims/guard.test.ts — the outstanding-recheck guard and
// the bounded sweep (BUILD §8 hard rule 4).
//
// The guard is what makes the promise safe: a draft is held from the
// instant the customer saves a change to their list, before any job runs,
// because outstanding-ness is a comparison of two hashes computed on read
// and not a flag anybody has to remember to set. The sweep only makes the
// *telling* timely, which is why truncating it can never release a page.
import "../env";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLAIM_RECHECK_SWEEP_MAX } from "../../../src/lib/config/constants";
import type { Measured } from "../../../src/lib/measure/measured";
import { AT, fakeCost, memoryStore, type MemoryStore } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

let store: MemoryStore;
let setGenerateStore: typeof import("../../../src/lib/generate/store").setGenerateStore;
let listHash: typeof import("../../../src/lib/generate/claims/hash").listHash;
let claimRecheckOutstanding: typeof import("../../../src/lib/generate/claims/outstanding").claimRecheckOutstanding;
let outstandingMatch: typeof import("../../../src/lib/generate/claims/outstanding").outstandingMatch;
let sweepOutstandingRechecks: typeof import("../../../src/lib/generate/claims/sweep").sweepOutstandingRechecks;

const LIST = ["HIPAA compliant"];

function measuredAnswer(value: unknown): Measured<unknown> {
  return { kind: "measured", value, at: AT };
}

beforeEach(async () => {
  llmMock.mockReset();
  ({ setGenerateStore } = await import("../../../src/lib/generate/store"));
  ({ listHash } = await import("../../../src/lib/generate/claims/hash"));
  ({ claimRecheckOutstanding, outstandingMatch } = await import(
    "../../../src/lib/generate/claims/outstanding"
  ));
  ({ sweepOutstandingRechecks } = await import("../../../src/lib/generate/claims/sweep"));
  store = memoryStore();
  store.site = { ...store.site!, doNotClaim: LIST };
  setGenerateStore(store);
});

afterEach(() => {
  setGenerateStore(null);
});

describe("the guard is derived, never stored", () => {
  it("a draft whose passing verdict carries the current hash is not outstanding", async () => {
    store.seed({
      id: "d1",
      claim_check: { state: "passed", listHash: listHash(LIST), at: AT.toISOString() },
    });
    expect(await claimRecheckOutstanding("d1")).toBe(false);
  });

  it("it becomes outstanding the instant the customer saves a change — no job runs in between", async () => {
    store.seed({
      id: "d1",
      claim_check: { state: "passed", listHash: listHash(LIST), at: AT.toISOString() },
    });
    expect(await claimRecheckOutstanding("d1")).toBe(false);
    store.site = { ...store.site!, doNotClaim: [...LIST, "SOC 2 certified"] };
    expect(await claimRecheckOutstanding("d1")).toBe(true);
  });

  it("a draft with no verdict at all is outstanding", async () => {
    store.seed({ id: "d1" });
    expect(await claimRecheckOutstanding("d1")).toBe(true);
  });

  it("an unrun verdict is outstanding — 'we could not check' is not 'it passed'", async () => {
    store.seed({ id: "d1", claim_check: { state: "unrun", reason: "cap_hit", at: AT.toISOString() } });
    expect(await claimRecheckOutstanding("d1")).toBe(true);
  });

  it("a draft the store does not hold is outstanding: a page we cannot read is not one we may release", async () => {
    expect(await claimRecheckOutstanding("nothing")).toBe(true);
  });

  it("it makes no model call", async () => {
    store.seed({ id: "d1" });
    await claimRecheckOutstanding("d1");
    expect(llmMock).not.toHaveBeenCalled();
  });
});

describe("outstandingMatch — the customer's own words, or nothing", () => {
  it("a failed verdict yields the entry it matched", async () => {
    store.seed({
      id: "d1",
      claim_check: {
        state: "failed",
        listHash: listHash(LIST),
        at: AT.toISOString(),
        matchedEntry: "HIPAA compliant",
      },
    });
    expect(await outstandingMatch("d1")).toEqual({ matchedEntry: "HIPAA compliant" });
  });

  it("a passing verdict yields null — there is nothing to name", async () => {
    store.seed({
      id: "d1",
      claim_check: { state: "passed", listHash: listHash(LIST), at: AT.toISOString() },
    });
    expect(await outstandingMatch("d1")).toBeNull();
  });
});

describe("the sweep is bounded and safe to truncate", () => {
  it(`checks at most ${CLAIM_RECHECK_SWEEP_MAX} drafts and reports the rest as deferred`, async () => {
    llmMock.mockResolvedValue(measuredAnswer({ matches: false, matchedIndex: null }));
    for (let i = 0; i < CLAIM_RECHECK_SWEEP_MAX + 5; i++) {
      store.seed({ id: `d${i}`, body_md: "Text with nothing on the list." });
    }
    const outcome = await sweepOutstandingRechecks(fakeCost(), store.site!.id);
    expect(outcome.checked).toBe(CLAIM_RECHECK_SWEEP_MAX);
    expect(outcome.deferred).toBe(5);
  });

  it("a deferred draft is still outstanding afterwards, so truncating delays a telling and releases nothing", async () => {
    llmMock.mockResolvedValue(measuredAnswer({ matches: false, matchedIndex: null }));
    for (let i = 0; i < CLAIM_RECHECK_SWEEP_MAX + 1; i++) {
      store.seed({ id: `d${i}`, body_md: "Text with nothing on the list." });
    }
    await sweepOutstandingRechecks(fakeCost(), store.site!.id);
    expect(await claimRecheckOutstanding(`d${CLAIM_RECHECK_SWEEP_MAX}`)).toBe(true);
  });

  it("a draft that states a listed claim is recorded as failed, with the customer's entry", async () => {
    store.seed({ id: "d1", body_md: "We are HIPAA compliant." });
    const outcome = await sweepOutstandingRechecks(fakeCost(), store.site!.id);
    expect(outcome.failed).toBe(1);
    expect(await outstandingMatch("d1")).toEqual({ matchedEntry: "HIPAA compliant" });
  });

  it("an unrun check never counts as a completed one and leaves the draft outstanding", async () => {
    llmMock.mockResolvedValue({ kind: "unmeasured", reason: "undeterminable", at: AT });
    store.seed({ id: "d1", body_md: "Text with nothing on the list." });
    const outcome = await sweepOutstandingRechecks(fakeCost(), store.site!.id);
    expect(outcome.checked).toBe(0);
    expect(await claimRecheckOutstanding("d1")).toBe(true);
  });

  it("a draft already current is not re-checked — the hash already says what a call would cost money to learn", async () => {
    store.seed({
      id: "d1",
      body_md: "Text with nothing on the list.",
      claim_check: { state: "passed", listHash: listHash(LIST), at: AT.toISOString() },
    });
    const outcome = await sweepOutstandingRechecks(fakeCost(), store.site!.id);
    expect(outcome.checked).toBe(0);
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("it logs counts and a hash prefix, and never the draft text or a list entry", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line: unknown) => {
      logged.push(String(line));
    });
    store.seed({ id: "d1", body_md: "We are HIPAA compliant." });
    await sweepOutstandingRechecks(fakeCost(), store.site!.id);
    spy.mockRestore();
    const sweepLine = logged.find((line) => line.includes("claim_recheck_sweep")) ?? "";
    expect(sweepLine).not.toContain("HIPAA");
    expect(sweepLine).toContain('"checked":1');
  });
});
