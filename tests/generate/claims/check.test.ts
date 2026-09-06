// tests/generate/claims/check.test.ts — BUILD §8 hard rule 4: the
// do-not-claim list as a hard output filter, "string + semantic match".
//
// Three promises, and each has a test that fails if it is dropped:
//   1. the literal pass runs first and short-circuits, so an obvious match
//      and an empty list both cost nothing;
//   2. the words named back to the customer are their own, out of their own
//      list, never the model's;
//   3. "we could not check" is `unrun`, never `passed`.
//
// No network: `@/lib/llm` is stubbed entirely, and the fake `CostContext`
// throws from `recordFetch`, so a path that reached the vendor any other
// way than through `llm()` fails here rather than going unexercised.
import "../env";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Measured } from "../../../src/lib/measure/measured";
import { fakeCost } from "../fixtures";

const { llmMock } = vi.hoisted(() => ({ llmMock: vi.fn() }));
vi.mock("@/lib/llm", () => ({ llm: llmMock }));

let claimCheck: typeof import("../../../src/lib/generate/claims/check").claimCheck;
let listHash: typeof import("../../../src/lib/generate/claims/hash").listHash;

beforeEach(async () => {
  llmMock.mockReset();
  ({ claimCheck } = await import("../../../src/lib/generate/claims/check"));
  ({ listHash } = await import("../../../src/lib/generate/claims/hash"));
});

function measuredAnswer(value: unknown): Measured<unknown> {
  return { kind: "measured", value, at: new Date("2026-09-06T00:00:00.000Z") };
}

const LIST = ["We are the fastest tool on the market", "HIPAA compliant"];
const BODY = "Our product is HIPAA compliant and always has been.";

describe("the literal pass runs first", () => {
  it("a literal match fails and makes no model call", async () => {
    const verdict = await claimCheck(fakeCost(), { text: BODY, list: LIST });
    expect(verdict.state).toBe("failed");
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("the entry it names is the customer's own recorded string, in their own case", async () => {
    const verdict = await claimCheck(fakeCost(), { text: BODY, list: LIST });
    expect(verdict.state === "failed" && verdict.matchedEntry).toBe("HIPAA compliant");
  });

  it("an empty list passes at zero cost, with the hash of the empty list", async () => {
    const verdict = await claimCheck(fakeCost(), { text: BODY, list: [] });
    expect(verdict.state).toBe("passed");
    expect(verdict.state === "passed" && verdict.listHash).toBe(listHash([]));
    expect(llmMock).not.toHaveBeenCalled();
  });
});

describe("the semantic pass runs only where the literal one found nothing", () => {
  it("a paraphrase fails through the nano pass, and still names the customer's entry", async () => {
    llmMock.mockResolvedValue(measuredAnswer({ matches: true, matchedIndex: 0 }));
    const verdict = await claimCheck(fakeCost(), {
      text: "Nothing else on the market comes close to our speed.",
      list: LIST,
    });
    expect(verdict.state === "failed" && verdict.matchedEntry).toBe(LIST[0]);
    expect(llmMock).toHaveBeenCalledTimes(1);
  });

  it("it calls the model at the nano tier — the cheap lane §8 prices the claim check in", async () => {
    llmMock.mockResolvedValue(measuredAnswer({ matches: false, matchedIndex: null }));
    await claimCheck(fakeCost(), { text: "Something unrelated entirely.", list: LIST });
    expect(llmMock.mock.calls[0]?.[1]).toMatchObject({ tier: "nano" });
  });

  it("a `matches: false` answer passes, carrying the hash of the list it was reached against", async () => {
    llmMock.mockResolvedValue(measuredAnswer({ matches: false, matchedIndex: null }));
    const verdict = await claimCheck(fakeCost(), { text: "Something unrelated.", list: LIST });
    expect(verdict.state).toBe("passed");
    expect(verdict.state === "passed" && verdict.listHash).toBe(listHash(LIST));
  });
});

describe("an unrun check is never a pass", () => {
  it("a model that did not answer yields `unrun` with `llm_unavailable`", async () => {
    llmMock.mockResolvedValue({
      kind: "unmeasured",
      reason: "undeterminable",
      at: new Date("2026-09-06T00:00:00.000Z"),
    });
    const verdict = await claimCheck(fakeCost(), { text: "Something unrelated.", list: LIST });
    expect(verdict).toMatchObject({ state: "unrun", reason: "llm_unavailable" });
  });

  it("the spend ceiling stops the call before it is made, and yields `unrun` with `cap_hit`", async () => {
    const verdict = await claimCheck(fakeCost({ capHit: () => true }), {
      text: "Something unrelated.",
      list: LIST,
    });
    expect(verdict).toMatchObject({ state: "unrun", reason: "cap_hit" });
    expect(llmMock).not.toHaveBeenCalled();
  });

  it("an answer that names an entry we do not hold is unrun, not failed — a page is never held on words the model wrote", async () => {
    llmMock.mockResolvedValue(measuredAnswer({ matches: true, matchedIndex: 99 }));
    const verdict = await claimCheck(fakeCost(), { text: "Something unrelated.", list: LIST });
    expect(verdict).toMatchObject({ state: "unrun" });
  });
});

describe("the model is asked for a boolean and an index, and for nothing a customer would read", () => {
  it("the response schema admits only `matches` and `matchedIndex`", async () => {
    llmMock.mockResolvedValue(measuredAnswer({ matches: false, matchedIndex: null }));
    await claimCheck(fakeCost(), { text: "Something unrelated.", list: LIST });
    const schema = (llmMock.mock.calls[0]?.[1] as { schema: { safeParse(v: unknown): { success: boolean } } })
      .schema;
    expect(schema.safeParse({ matches: false, matchedIndex: null }).success).toBe(true);
    expect(schema.safeParse({ matches: false, matchedIndex: null, sentence: "..." }).success).toBe(false);
  });
});
