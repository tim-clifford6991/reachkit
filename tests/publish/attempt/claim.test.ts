// tests/publish/attempt/claim.test.ts — the claim, and ADR-080's three
// discriminating cases.
//
// ADR-080 requires exactly three tests, and each is written so that
// relaxing the conflict clause fails it:
//
//   1. a retry of an attempt whose outcome was never confirmed creates no
//      second publication;
//   2. an attempt against an unpublished page gains no post;
//   3. a disconnect and reconnect does not restart the pair as a first
//      attempt.
//
// Plus the ordering the whole guarantee rests on: the row is written before
// anything leaves the process, and the switch is read inside the claim.
//
// The archived plan is WO-212.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, installTransitionRpc, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { claim } from "@/lib/publish/attempt/claim";
import { setPublishing } from "@/lib/publish/switch";
import type { Actor } from "@/lib/publish/types";
import type { GuardDeps } from "@/lib/publish/machine";

const SYSTEM: Actor = { kind: "system", job: "publish/execute" };
const AT = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));

function openDeps(over: Partial<GuardDeps> = {}): GuardDeps {
  return {
    isPublishingOn: async () => true,
    hasCeilingRoom: async () => true,
    destinationWorking: async () => true,
    rule: { becomesPublishable: () => true, toldCurrentPair: () => true },
    ...over,
  };
}

function seed(state = "approved", over: Row = {}): void {
  db.reset();
  installTransitionRpc(db);
  db.seed("sites", [
    { id: "s1", mode: "autopilot", veto_hours: 24, publishing_enabled: true, timezone: "America/New_York" },
  ]);
  db.seed("destinations", [{ id: "dest-1", site_id: "s1", kind: "hosted", health: "ok", config: {} }]);
  db.seed("drafts", [
    {
      id: "d1",
      site_id: "s1",
      state,
      transitions: [],
      hard_rules_passed: true,
      publishable_since: null,
      veto_deadline: null,
      approved_at: null,
      opportunity_id: "o1",
      ...over,
    },
  ]);
  db.seed("publications", []);
}

beforeEach(() => seed());

describe("a first claim writes the row before anything leaves the process", () => {
  it("inserts one publication, claimed, at attempt 1", async () => {
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(result).toMatchObject({ ok: true, alreadyPublished: false, attemptNo: 1 });
    const rows = db.rows("publications");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      draft_id: "d1",
      destination: "hosted",
      delivery_state: "claimed",
      attempt_no: 1,
    });
  });

  it("the page is moved to publishing by the machine, not by this file", async () => {
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(db.rows("drafts")[0]?.state).toBe("publishing");
    expect(db.rpcCalls.map((c) => c.fn)).toEqual(["publish_transition"]);
  });

  it("made_live_by_us is not named in the insert — nothing is yet known about what this call did", async () => {
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    const insert = db.queries.find((q) => q.verb === "insert" && q.table === "publications");
    expect(insert?.values).toBeDefined();
    expect(Object.keys(insert?.values ?? {})).not.toContain("made_live_by_us");
    expect(Object.keys(insert?.values ?? {})).not.toContain("live_url");
  });

  it("the claim makes no outbound call — the adapter is not reached from here", async () => {
    const real = globalThis.fetch;
    const forbidden = vi.fn(() => {
      throw new Error("the claim must reach no network");
    });
    globalThis.fetch = forbidden as unknown as typeof fetch;
    try {
      await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    } finally {
      globalThis.fetch = real;
    }
    expect(forbidden).not.toHaveBeenCalled();
  });
});

describe("ADR-080 case 1 — a retry of an attempt whose outcome was never confirmed", () => {
  it("creates no second publication and re-claims the one that exists", async () => {
    const first = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    // The delivery happened; the outcome was never written. The page is
    // back in a state an attempt can start from.
    db.rows("drafts")[0]!.state = "failed";

    const second = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(db.rows("publications")).toHaveLength(1);
    if (!first.ok || !second.ok) throw new Error("both claims should succeed");
    expect(second.publicationId).toBe(first.publicationId);
    expect(second.attemptNo).toBe(2);
  });

  it("a delivered row refuses the re-claim and reports alreadyPublished", async () => {
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    const row = db.rows("publications")[0]!;
    row.delivery_state = "delivered";
    row.made_live_by_us = true;
    row.live_url = "https://content.example.com/a";
    db.rows("drafts")[0]!.state = "failed";

    const again = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(again).toMatchObject({ ok: true, alreadyPublished: true });
    expect(db.rows("publications")).toHaveLength(1);
  });

  it("a re-claim of a delivered row leaves made_live_by_us and live_url exactly as they were", async () => {
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    const row = db.rows("publications")[0]!;
    row.delivery_state = "delivered";
    row.made_live_by_us = true;
    row.live_url = "https://content.example.com/a";
    db.rows("drafts")[0]!.state = "failed";

    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(db.rows("publications")[0]?.made_live_by_us).toBe(true);
    expect(db.rows("publications")[0]?.live_url).toBe("https://content.example.com/a");
  });

  it("a re-claim of a failed row touches neither column — the update names them in no set list", async () => {
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    const row = db.rows("publications")[0]!;
    row.delivery_state = "failed";
    row.made_live_by_us = true;
    db.rows("drafts")[0]!.state = "failed";
    db.queries.length = 0;

    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    const update = db.queries.find((q) => q.verb === "update" && q.table === "publications");
    expect(Object.keys(update?.values ?? {})).toEqual(["delivery_state", "attempt_no", "claimed_at"]);
    expect(db.rows("publications")[0]?.made_live_by_us).toBe(true);
  });

  it("the conflict clause is on the write, not only on the read — the update refuses a delivered row", async () => {
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    db.rows("drafts")[0]!.state = "failed";
    db.queries.length = 0;
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    const update = db.queries.find((q) => q.verb === "update" && q.table === "publications");
    expect(update?.filters).toContainEqual({ op: "neq", column: "delivery_state", value: "delivered" });
  });
});

describe("ADR-080 case 2 — an attempt after the page was unpublished", () => {
  it("gains no post: `unpublished` is the source of no edge, so no claim is taken", async () => {
    seed("unpublished");
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(result.ok).toBe(false);
    expect(db.rows("publications")).toHaveLength(0);
    expect(db.rows("drafts")[0]?.state).toBe("unpublished");
  });

  it("and neither does a page the customer skipped", async () => {
    seed("skipped");
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(result.ok).toBe(false);
    expect(db.rows("publications")).toHaveLength(0);
  });
});

describe("ADR-080 case 3 — disconnect and reconnect does not restart the pair", () => {
  it("the second claim after a destination came back is attempt 2, on the same row", async () => {
    await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    db.rows("publications")[0]!.delivery_state = "failed";
    db.rows("drafts")[0]!.state = "failed";

    // The customer disconnected and reconnected: a new destinations row.
    db.seed("destinations", [
      { id: "dest-2", site_id: "s1", kind: "hosted", health: "ok", config: {} },
    ]);

    const again = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(db.rows("publications")).toHaveLength(1);
    expect(again).toMatchObject({ ok: true, attemptNo: 2 });
  });
});

describe("the unique index adjudicates a race, not application code", () => {
  it("a claim whose insert loses re-reads the winner's row instead of creating a second", async () => {
    // Two claims that both found no row: the second's insert is rejected by
    // the index, which is the whole mechanism.
    db.rows("publications").push({
      id: "pub-winner",
      draft_id: "d1",
      site_id: "s1",
      destination: "hosted",
      delivery_state: "claimed",
      attempt_no: 1,
      mode: "autopilot",
    });
    db.queries.length = 0;
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(db.rows("publications")).toHaveLength(1);
    expect(result).toMatchObject({ ok: true, publicationId: "pub-winner", attemptNo: 2 });
  });
});

describe("the switch is read inside the claim, so switching off is instant", () => {
  it("an invocation that began before the switch was recorded and reaches the claim after is held", async () => {
    // The deps read the live column, exactly as the default ones do.
    const deps = openDeps({ isPublishingOn: async (siteId) => {
      const site = db.rows("sites").find((s) => s.id === siteId);
      return site?.publishing_enabled === true;
    } });

    await setPublishing("s1", false, { kind: "customer", userId: "u1" });

    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps });
    expect(result).toEqual({ ok: false, reason: "held", heldBy: "switch_off" });
    expect(db.rows("publications")).toHaveLength(0);
    expect(db.rows("drafts")[0]?.state).toBe("approved");
  });

  it("a page whose retry fell due while the switch is off is held in failed, not moved", async () => {
    seed("failed");
    const result = await claim({
      draftId: "d1",
      destination: "hosted",
      by: SYSTEM,
      at: AT,
      deps: openDeps({ isPublishingOn: async () => false }),
    });
    expect(result).toEqual({ ok: false, reason: "held", heldBy: "switch_off" });
    expect(db.rows("drafts")[0]?.state).toBe("failed");
  });
});

describe("every refusal is a hold, and names which one", () => {
  const holds: [string, Partial<GuardDeps>][] = [
    ["not_publishable", { rule: { becomesPublishable: (): boolean => false, toldCurrentPair: (): boolean => true } }],
    ["telling_owed", { rule: { becomesPublishable: (): boolean => true, toldCurrentPair: (): boolean => false } }],
    ["destination_not_working", { destinationWorking: async (): Promise<boolean> => false }],
  ];

  it.each(holds)("%s", async (heldBy, over) => {
    const result = await claim({
      draftId: "d1",
      destination: "hosted",
      by: SYSTEM,
      at: AT,
      deps: openDeps(over),
    });
    expect(result).toEqual({ ok: false, reason: "held", heldBy });
    expect(db.rows("publications")).toHaveLength(0);
  });

  it("a full day names the day ceiling, and the page keeps its state", async () => {
    db.seed("publications", [
      { id: "p1", site_id: "s1", published_at: "2026-09-15T13:00:00.000Z", destination: "hosted" },
    ]);
    const result = await claim({
      draftId: "d1",
      destination: "hosted",
      by: SYSTEM,
      at: AT,
      deps: openDeps({ hasCeilingRoom: async () => false }),
    });
    expect(result).toEqual({ ok: false, reason: "held", heldBy: "ceiling_day" });
    expect(db.rows("drafts")[0]?.state).toBe("approved");
  });

  it("a needs_attention page whose draft failed a hard rule is held, naming that", async () => {
    seed("needs_attention", { hard_rules_passed: false });
    const result = await claim({ draftId: "d1", destination: "hosted", by: SYSTEM, at: AT, deps: openDeps() });
    expect(result).toEqual({ ok: false, reason: "held", heldBy: "hard_rules_not_passed" });
  });
});
