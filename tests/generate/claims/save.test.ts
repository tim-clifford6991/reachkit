// tests/generate/claims/save.test.ts — BUILD §4.7 · §8, REQ-053 c5,
// DECISIONS 2026-09-07 (#178)
//
// The one writer of `sites.do_not_claim`, and the sweep that runs beside
// it.
//
// Two properties, and they pull in opposite directions. The write must land
// before the sweep, because the guard re-checks against the *stored* list
// and a page must never be judged against a list the customer has not
// saved. And a sweep that cannot run must not fail the save, because every
// affected page is already held — outstanding-ness is derived from the two
// hashes, so the hold exists whether or not anything sweeps, and telling a
// customer their list did not save would be false.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { sweep, withDraftCost, dbState } = vi.hoisted(() => ({
  sweep: vi.fn(),
  withDraftCost: vi.fn(),
  /** What the one update answers. A suite that could not make the write
   *  fail could not tell a throw from a swallow. */
  dbState: { error: null as { message: string } | null },
}));

vi.mock("@/lib/generate/claims/sweep", () => ({ sweepOutstandingRechecks: sweep }));
vi.mock("@/lib/generate/cost", () => ({
  withDraftCost: (a: unknown, body: (c: unknown) => Promise<unknown>) => withDraftCost(a, body),
}));

/** The order every observable act happened in, so "the write lands first"
 *  is a fact this suite reads rather than a claim it repeats. */
const order: string[] = [];
const update = vi.fn();

vi.mock("@/lib/db", () => ({
  dbAdmin: () => ({
    from: () => {
      const self: Record<string, unknown> = {
        update: (values: Record<string, unknown>) => {
          order.push("write");
          update(values);
          return self;
        },
        eq: () => self,
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve(resolve({ data: dbState.error === null ? [] : null, error: dbState.error })),
      };
      return self;
    },
  }),
}));

const { normaliseClaimList, saveDoNotClaim } = await import("@/lib/generate/claims/save");

beforeEach(() => {
  vi.clearAllMocks();
  order.length = 0;
  dbState.error = null;
  sweep.mockImplementation(async () => {
    order.push("sweep");
    return { checked: 2, failed: 0, deferred: 0 };
  });
  withDraftCost.mockImplementation(
    (_a: unknown, body: (c: unknown) => Promise<unknown>) => body({})
  );
});

describe("the write lands first, and the sweep runs beside it", () => {
  it("writes the list, then sweeps — never the other way round", async () => {
    await saveDoNotClaim({ siteId: "site-1", entries: ["fastest on the market"], scanId: "scan-1" });
    expect(order).toEqual(["write", "sweep"]);
  });

  it("writes `do_not_claim` and nothing else", async () => {
    await saveDoNotClaim({ siteId: "site-1", entries: ["a claim"], scanId: "scan-1" });
    expect(update).toHaveBeenCalledWith({ do_not_claim: ["a claim"] });
  });

  it("sweeps that site, under the generation cap and against the scan that grounds its pages", async () => {
    await saveDoNotClaim({ siteId: "site-1", entries: [], scanId: "scan-9" });
    expect(withDraftCost).toHaveBeenCalledWith({ scanId: "scan-9" }, expect.any(Function));
    expect(sweep).toHaveBeenCalledWith({}, "site-1");
  });

  it("reports what the sweep found", async () => {
    const result = await saveDoNotClaim({ siteId: "site-1", entries: ["x"], scanId: "scan-1" });
    expect(result).toEqual({ doNotClaim: ["x"], swept: { checked: 2, failed: 0, deferred: 0 } });
  });
});

describe("a sweep that cannot run leaves the list saved and the pages held", () => {
  it("the save succeeds and says the sweep did not", async () => {
    sweep.mockRejectedValue(new Error("the model is unreachable"));
    const result = await saveDoNotClaim({ siteId: "site-1", entries: ["x"], scanId: "scan-1" });
    expect(result).toEqual({ doNotClaim: ["x"], swept: null });
  });

  it("and the write still happened — the customer's list is theirs, saved", async () => {
    sweep.mockRejectedValue(new Error("unreachable"));
    await saveDoNotClaim({ siteId: "site-1", entries: ["x"], scanId: "scan-1" });
    expect(update).toHaveBeenCalledWith({ do_not_claim: ["x"] });
  });

  it("a write that fails is a throw — the list is the customer's answer, not a best effort", async () => {
    dbState.error = { message: "refused" };
    await expect(
      saveDoNotClaim({ siteId: "site-1", entries: ["x"], scanId: "scan-1" })
    ).rejects.toThrow(/could not save/);
    expect(sweep).not.toHaveBeenCalled();
  });
});

describe("the list is normalised on the way in, so the hash is stable", () => {
  it("trims, drops blanks and de-duplicates, keeping the customer's order", () => {
    expect(normaliseClaimList(["  fastest ", "", "GDPR certified", "fastest", "  "])).toEqual([
      "fastest",
      "GDPR certified",
    ]);
  });

  it("two lists that filter identically are one list, so nothing is re-checked for nothing", () => {
    expect(normaliseClaimList([" a ", "b"])).toEqual(normaliseClaimList(["a", " b "]));
  });

  it("an empty list is an answer — the customer may claim anything", () => {
    expect(normaliseClaimList([])).toEqual([]);
  });
});
