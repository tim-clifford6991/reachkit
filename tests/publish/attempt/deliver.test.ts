// tests/publish/attempt/deliver.test.ts — BUILD §9 (issue #173)
//
// The approve-and-deliver edge, as `publish/execute` calls it. Three
// outcomes and no fourth, and each test is written so that a page resting
// somewhere none of them describes fails it.
//
// What is asserted here is the orchestration: which of the three the leaf
// reports, that the destination's *kind* is read from the row rather than
// taken from the payload, that the +24h check's due-ness follows the
// address, and that a failure has already been through the retry policy by
// the time this returns. The claim, the guards, the delivery and the retry
// decision are each owned and tested elsewhere.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const deliver = vi.fn(async () => ({ ok: true, madeLive: true, liveUrl: "https://s1.example/page", remoteId: "42" }));

vi.mock("@/lib/publish/destinations/registry", () => ({
  adapterFor: () => ({
    kind: "wordpress",
    servesPublicly: true,
    hostedByUs: false,
    deliver: (...args: unknown[]) => deliver(...(args as [])),
    unpublish: async () => ({ ok: false, reason: "destination_unavailable" }),
    health: async () => ({ health: "ok" }),
  }),
}));

vi.mock("@/lib/publish/destinations/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/publish/destinations/config")>();
  // The credential is opened for the duration of the one call that needs
  // it (#54); this file has no credential and no vendor, so the seam hands
  // the delivery an empty config and nothing is sealed or unsealed.
  const withConfig = async (_id: string, run: (config: unknown) => unknown) => run({});
  return { ...actual, withConfig };
});

import { deliverApproved } from "@/lib/publish/attempt/deliver";
import type { GuardDeps } from "@/lib/publish/machine";

const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

/** The nine guard facts, all open. Each of them is owned and tested in
 *  `tests/publish/machine/`; what this file is about is which of the three
 *  outcomes the edge reports, so it drives them the way `claim.test.ts`
 *  does rather than standing up nine sets of rows. */
function openDeps(over: Partial<GuardDeps> = {}): GuardDeps {
  return {
    claimRecheckOutstanding: async () => false,
    outstandingMatch: async () => null,
    reachKitStopped: async () => false,
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
    ...over,
  };
}

function run(over: Partial<GuardDeps> = {}) {
  return deliverApproved({ draftId: "d1", destinationId: "dest-1", at: AT, deps: openDeps(over) });
}

function seed(over: { draft?: Row; destination?: Row | null } = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    { id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true, timezone: "America/New_York" },
  ]);
  db.seed(
    "destinations",
    over.destination === null
      ? []
      : [
          {
            id: "dest-1",
            site_id: "s1",
            kind: "wordpress",
            health: "ok",
            deleted_at: null,
            publish_capable: null,
            config: {},
            ...over.destination,
          },
        ]
  );
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state: "approved",
      title: "A page",
      body_md: "# A page",
      meta: {},
      transitions: [],
      hard_rules_passed: true,
      publishable_since: "2026-09-14T00:00:00.000Z",
      veto_deadline: "2026-09-15T00:00:00.000Z",
      approved_at: "2026-09-15T00:00:00.000Z",
      opportunity_id: "o1",
      told_at: "2026-09-14T00:00:00.000Z",
      ...over.draft,
    },
  ]);
  db.seed("opportunities", [{ id: "o1", site_id: "s1", proposed_slug: "a-page" }]);
  db.seed("publications", []);
}

beforeEach(() => {
  seed();
  deliver.mockClear();
});

describe("a page that goes out", () => {
  it("is delivered, is published, and reports the check as due because an address came back", async () => {
    const outcome = await run();
    expect(outcome).toMatchObject({ kind: "delivered", verifyDue: true, alreadyPublished: false });
    expect(db.rows("drafts")[0]?.state).toBe("published");
    const publication = db.rows("publications")[0];
    expect(publication).toMatchObject({ delivery_state: "delivered", made_live_by_us: true });
    expect(publication?.verify_due_at).not.toBeNull();
  });

  it("reads the destination's kind from the row rather than trusting the payload's id", async () => {
    // The claim re-reads the site's live destination at the moment of the
    // attempt; the id in the event was minted when the page was approved.
    seed({ destination: { kind: "hosted" } });
    await run();
    const insert = db.queries.find((q) => q.verb === "insert" && q.table === "publications");
    expect(insert?.values?.destination).toBe("hosted");
  });

  it("calls the adapter exactly once", async () => {
    await run();
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it("a delivery that came back with no address is not due for the check", async () => {
    // BP-049: the address decides, never the destination kind. A page the
    // check could not look at is never queued for one.
    deliver.mockResolvedValueOnce({ ok: true, madeLive: true, remoteId: "42" } as never);
    const outcome = await run();
    expect(outcome).toMatchObject({ kind: "delivered", verifyDue: false });
    expect(db.rows("publications")[0]?.verify_due_at).toBeNull();
  });
});

describe("a page that is held", () => {
  it("is reported held, keeps the state it holds, and no page is moved", async () => {
    const outcome = await run({ isPublishingOn: async () => false });
    expect(outcome).toEqual({ kind: "held", heldBy: "switch_off" });
    expect(db.rows("drafts")[0]?.state).toBe("approved");
    expect(db.rows("publications")).toHaveLength(0);
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("a page that did not go out", () => {
  it("a reason the customer must clear brings it to rest needing them, in this same invocation", async () => {
    deliver.mockResolvedValueOnce({ ok: false, madeLive: false, reason: "credentials_invalid" } as never);
    const outcome = await run();
    expect(outcome).toMatchObject({ kind: "failed", reason: "credentials_invalid" });
    expect(outcome).toMatchObject({ decision: { kind: "needs_attention", because: "reason_needs_customer" } });
    expect(db.rows("drafts")[0]?.state).toBe("needs_attention");
    expect(db.rows("publications")[0]).toMatchObject({
      delivery_state: "failed",
      failure_reason: "credentials_invalid",
    });
  });

  it("a reason a repeated attempt could clear leaves the page in failed with a retry due", async () => {
    deliver.mockResolvedValueOnce({ ok: false, madeLive: false, reason: "network" } as never);
    const outcome = await run();
    expect(outcome).toMatchObject({ kind: "failed", reason: "network", decision: { kind: "retry" } });
    expect(db.rows("drafts")[0]?.state).toBe("failed");
  });

  it("a destination that is gone is a hold, not a failure — the page keeps its state", async () => {
    // There is no kind to claim against, no attempt is made, and the
    // machine has no `approved → needs_attention` edge to take: §9 holds
    // the queue against a destination that is not working and the page
    // goes out when the customer reconnects.
    seed({ destination: null });
    const outcome = await run();
    expect(outcome).toEqual({ kind: "held", heldBy: "destination_not_working" });
    expect(db.rows("drafts")[0]?.state).toBe("approved");
    expect(deliver).not.toHaveBeenCalled();
  });

  it("a destination disconnected since the approval is the same answer", async () => {
    seed({ destination: { deleted_at: "2026-09-14T00:00:00.000Z" } });
    const outcome = await run();
    expect(outcome).toEqual({ kind: "held", heldBy: "destination_not_working" });
    expect(db.rows("drafts")[0]?.state).toBe("approved");
  });
});
