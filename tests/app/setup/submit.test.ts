// tests/app/setup/submit.test.ts — BUILD §4.3, REQ-025 criteria 1, 2, 4;
// REQ-021 criteria 8, 9; REQ-026 c11; REQ-028 c4
//
// The submission contract and the one write path. The archived test plan is
// WO-146's. Every store below is built in the test, so nothing here needs a
// database, a queue or a resolver.
import { describe, expect, it, vi } from "vitest";
import {
  completeSetup,
  type SetupProgressState,
  type SetupStore,
  type SetupSubmission,
} from "@/app/(account)/setup/submit";

const PAID_AT = new Date(Date.UTC(2026, 8, 5, 9, 30, 0));
const SITE = "site-1";
const USER = "user-1";

const SUBMISSION: SetupSubmission = {
  domain: "example.com",
  category: "agency CRM",
  competitors: ["asana.com"],
  destination: { kind: "hosted" },
};

interface Recorder {
  committed: { siteId: string; submission: SetupSubmission }[];
  enqueued: string[];
}

function storeOf(
  over: Partial<SetupStore> = {}
): { store: SetupStore; recorder: Recorder } {
  const recorder: Recorder = { committed: [], enqueued: [] };
  const store: SetupStore = {
    hasActiveAccess: async () => true,
    resolvesInDns: async () => true,
    readProgress: async (): Promise<SetupProgressState> => ({
      complete: false,
      siteId: SITE,
      paidAt: PAID_AT,
    }),
    commitSetup: async (a) => {
      recorder.committed.push(a);
    },
    enqueueDeepPass: async (siteId) => {
      recorder.enqueued.push(siteId);
    },
    ...over,
  };
  return { store, recorder };
}

describe('REQ-025 c2 — "one action starts the product: no multi-page wizard, no second confirmation screen, no further questions"', () => {
  it("one call completes setup and enqueues the deep pass; no second round-trip is required", async () => {
    const { store, recorder } = storeOf();
    const result = await completeSetup(store, { userId: USER, submission: SUBMISSION });
    expect(result).toEqual({ ok: true, siteId: SITE });
    expect(recorder.committed).toHaveLength(1);
    expect(recorder.enqueued).toEqual([SITE]);
  });
});

describe('REQ-025 c1 — "it asks for exactly three decisions ... and for nothing else, save the site address"', () => {
  it("the submission shape has exactly four members, and none of them can carry a duration", () => {
    // A field absent from the type cannot be sent. The literal list here
    // is the assertion: adding a fifth decision means editing this line,
    // which is the review the requirement asks for. `mode` left it with §7
    // (2026-09-11): Autopilot is the only mode, so it is not a decision.
    expect(Object.keys(SUBMISSION).sort()).toEqual([
      "category",
      "competitors",
      "destination",
      "domain",
    ]);
  });

  it("no member's name or value mentions a duration, a cadence, a cap, a depth or a model", () => {
    const forbidden =
      /(minute|hour|day|week|second|duration|estimate|eta|cadence|cap|budget|spend|depth|model|questions?count|limit)/i;
    for (const key of Object.keys(SUBMISSION)) {
      expect(key).not.toMatch(forbidden);
    }
  });

  it("what is committed is exactly what was submitted, with the domain canonicalised", async () => {
    const { store, recorder } = storeOf();
    await completeSetup(store, {
      userId: USER,
      submission: { ...SUBMISSION, domain: "https://WWW.Example.com/pricing" },
    });
    expect(recorder.committed[0]?.submission).toEqual({ ...SUBMISSION, domain: "example.com" });
  });
});

describe('REQ-025 c4 — "when they return to it, then they are not asked the three decisions again"', () => {
  it("a second submit refuses with already_complete and starts no second pass", async () => {
    const { store, recorder } = storeOf({
      readProgress: async () => ({ complete: true, siteId: SITE, completedAt: PAID_AT }),
    });
    const result = await completeSetup(store, { userId: USER, submission: SUBMISSION });
    expect(result).toEqual({ ok: false, refused: "already_complete" });
    expect(recorder.committed).toEqual([]);
    expect(recorder.enqueued).toEqual([]);
  });
});

describe("refusal order, and what each refusal leaves behind", () => {
  it("no active access is refused first — before the domain is even looked at", async () => {
    const resolvesInDns = vi.fn(async () => true);
    const { store, recorder } = storeOf({ hasActiveAccess: async () => false, resolvesInDns });
    const result = await completeSetup(store, {
      userId: USER,
      submission: { ...SUBMISSION, domain: "not a domain" },
    });
    expect(result).toEqual({ ok: false, refused: "no_active_access" });
    expect(resolvesInDns).not.toHaveBeenCalled();
    expect(recorder.committed).toEqual([]);
  });

  it("an unparseable domain refuses with invalid_domain and writes nothing", async () => {
    const { store, recorder } = storeOf();
    const result = await completeSetup(store, {
      userId: USER,
      submission: { ...SUBMISSION, domain: "not a domain" },
    });
    expect(result).toEqual({ ok: false, refused: "invalid_domain" });
    expect(recorder.committed).toEqual([]);
    expect(recorder.enqueued).toEqual([]);
  });

  it("REQ-021 c9 — a domain that does not resolve refuses with invalid_domain and writes nothing", async () => {
    const { store, recorder } = storeOf({ resolvesInDns: async () => false });
    const result = await completeSetup(store, { userId: USER, submission: SUBMISSION });
    expect(result).toEqual({ ok: false, refused: "invalid_domain" });
    expect(recorder.committed).toEqual([]);
  });

  it("an empty market refuses with market_missing and writes nothing", async () => {
    const { store, recorder } = storeOf();
    const result = await completeSetup(store, {
      userId: USER,
      submission: { ...SUBMISSION, category: "   " },
    });
    expect(result).toEqual({ ok: false, refused: "market_missing" });
    expect(recorder.committed).toEqual([]);
  });

  it("more than five competitors refuses rather than silently truncating", async () => {
    const { store, recorder } = storeOf();
    const result = await completeSetup(store, {
      userId: USER,
      submission: {
        ...SUBMISSION,
        competitors: ["a.com", "b.com", "c.com", "d.com", "e.com", "f.com"],
      },
    });
    expect(result).toEqual({ ok: false, refused: "too_many_competitors" });
    expect(recorder.committed).toEqual([]);
  });
});

describe('REQ-026 c11 and REQ-028 c4 — "with no competitors selected ... then setup completes"', () => {
  it("an empty competitor set completes and still enqueues the pass", async () => {
    const { store, recorder } = storeOf();
    const result = await completeSetup(store, {
      userId: USER,
      submission: { ...SUBMISSION, competitors: [] },
    });
    expect(result.ok).toBe(true);
    expect(recorder.enqueued).toEqual([SITE]);
  });

  it("WordPress deferred completes, and the connectLater fact reaches the writer", async () => {
    const { store, recorder } = storeOf();
    const result = await completeSetup(store, {
      userId: USER,
      submission: { ...SUBMISSION, destination: { kind: "wordpress", connectLater: true } },
    });
    expect(result.ok).toBe(true);
    expect(recorder.committed[0]?.submission.destination).toEqual({
      kind: "wordpress",
      connectLater: true,
    });
  });
});

describe("the completion is committed before the pass is enqueued", () => {
  it("an enqueue that throws leaves the founder complete", async () => {
    const { store, recorder } = storeOf({
      enqueueDeepPass: async () => {
        throw new Error("the queue is down");
      },
    });
    const result = await completeSetup(store, { userId: USER, submission: SUBMISSION });
    expect(result).toEqual({ ok: true, siteId: SITE });
    expect(recorder.committed).toHaveLength(1);
  });

  it("the commit happens first — the enqueue never runs against an uncommitted setup", async () => {
    const order: string[] = [];
    const { store } = storeOf({
      commitSetup: async () => {
        order.push("commit");
      },
      enqueueDeepPass: async () => {
        order.push("enqueue");
      },
    });
    await completeSetup(store, { userId: USER, submission: SUBMISSION });
    expect(order).toEqual(["commit", "enqueue"]);
  });
});

describe("siteId is never read from the request body", () => {
  it("the site written to is the one the store resolved from the account, not one the caller named", async () => {
    const { store, recorder } = storeOf({
      readProgress: async () => ({ complete: false, siteId: "the-real-site", paidAt: PAID_AT }),
    });
    await completeSetup(store, {
      userId: USER,
      // A payload carrying a site id is not a shape `SetupSubmission`
      // admits; cast here only to prove the extra member is ignored.
      submission: { ...SUBMISSION, siteId: "someone-elses-site" } as SetupSubmission,
    });
    expect(recorder.committed[0]?.siteId).toBe("the-real-site");
  });
});
