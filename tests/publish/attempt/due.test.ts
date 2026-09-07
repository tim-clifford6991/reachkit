// tests/publish/attempt/due.test.ts — BUILD §9 (issue #200)
//
// The retries that have come round. Each test is written so that relaxing
// one of the three predicates fails it, and the two that carry the issue's
// own promises — one attempt per due retry, and a second tick inside the
// same hour claiming nothing twice — are asserted against the arithmetic
// rather than against a stored column, because there is no stored column
// and that is the design.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

import { dueRetries, retryDueAt } from "@/lib/publish/attempt/due";
import { MAX_RETRIES } from "@/lib/publish/attempt/retry";
import { PUBLISH_RETRY_BACKOFF_MIN } from "@/lib/config/constants";

const CLAIMED = new Date(Date.UTC(2026, 8, 15, 12, 0, 0));
const MINUTE = 60_000;

function after(minutes: number): Date {
  return new Date(CLAIMED.getTime() + minutes * MINUTE);
}

function seed(over: { publication?: Row; draft?: Row; destination?: Row | null } = {}): void {
  db.reset();
  db.seed("sites", [{ id: "s1", publishing_enabled: true, timezone: "America/New_York" }]);
  db.seed(
    "destinations",
    over.destination === null
      ? []
      : [{ id: "dest-1", site_id: "s1", kind: "wordpress", deleted_at: null, ...over.destination }]
  );
  db.seed("drafts", [{ id: "d1", site_id: "s1", state: "failed", ...over.draft }]);
  db.seed("publications", [
    {
      id: "pub-1",
      draft_id: "d1",
      destination: "wordpress",
      delivery_state: "failed",
      attempt_no: 1,
      claimed_at: CLAIMED.toISOString(),
      failure_reason: "network",
      ...over.publication,
    },
  ]);
}

beforeEach(() => seed());

describe("the due moment is the schedule's own, read off the row the claim wrote", () => {
  it("is claimed_at plus the backoff step for the attempt just made", () => {
    for (const [index, minutes] of PUBLISH_RETRY_BACKOFF_MIN.entries()) {
      expect(retryDueAt(CLAIMED, index + 1)).toEqual(after(minutes));
    }
  });

  it("names no moment once the last permitted retry has been made", () => {
    // The page is not due again: `deliverApproved` moved it to
    // `needs_attention` through the machine's own edge on that attempt.
    expect(retryDueAt(CLAIMED, MAX_RETRIES + 1)).toBeNull();
  });
});

describe("a page whose retry has come round", () => {
  it("is offered, addressed by destination id rather than by kind", async () => {
    expect(await dueRetries(after(5))).toEqual([{ draftId: "d1", destinationId: "dest-1" }]);
  });

  it("is offered on the moment, not only after it", async () => {
    expect(await dueRetries(after(PUBLISH_RETRY_BACKOFF_MIN[0] ?? 5))).toHaveLength(1);
  });

  it("is not offered a minute early", async () => {
    expect(await dueRetries(after(4))).toEqual([]);
  });

  it("waits the longer step once it has failed twice", async () => {
    seed({ publication: { attempt_no: 2 } });
    expect(await dueRetries(after(5))).toEqual([]);
    expect(await dueRetries(after(PUBLISH_RETRY_BACKOFF_MIN[1] ?? 30))).toHaveLength(1);
  });

  it("reads the failed rows once and the destinations once, whatever the number of pages", async () => {
    await dueRetries(after(5));
    expect(db.queries.filter((q) => q.table === "publications")).toHaveLength(1);
    expect(db.queries.filter((q) => q.table === "destinations")).toHaveLength(1);
  });
});

describe("a page the sweep must not claim", () => {
  it("one that has used its last permitted retry — it has come to rest", async () => {
    seed({ publication: { attempt_no: MAX_RETRIES + 1 } });
    expect(await dueRetries(after(10_000))).toEqual([]);
  });

  it("one already moved to needs_attention", async () => {
    seed({ draft: { state: "needs_attention" } });
    expect(await dueRetries(after(10_000))).toEqual([]);
  });

  it("one a customer has moved on themselves", async () => {
    seed({ draft: { state: "skipped" } });
    expect(await dueRetries(after(10_000))).toEqual([]);
  });

  it("one whose delivery landed after all", async () => {
    seed({ publication: { delivery_state: "delivered" } });
    expect(await dueRetries(after(10_000))).toEqual([]);
  });

  it("one still being attempted", async () => {
    seed({ publication: { delivery_state: "claimed" } });
    expect(await dueRetries(after(10_000))).toEqual([]);
  });

  it("one whose destination was disconnected since it failed — there is nothing to address it to", async () => {
    seed({ destination: null });
    expect(await dueRetries(after(10_000))).toEqual([]);
  });
});

describe("the switch is not asked here — §9 withholds a retry, it does not cancel one", () => {
  it("a page on a site with publishing off is still offered, and the claim is what refuses it", async () => {
    // The guard is read inside the claim, at the moment of the attempt.
    // Asking twice would be a second copy of a rule whose whole point is
    // where it is read — and a sweep that filtered here would stop
    // offering the page and never start again when the switch came back.
    db.rows("sites")[0]!.publishing_enabled = false;
    expect(await dueRetries(after(5))).toEqual([{ draftId: "d1", destinationId: "dest-1" }]);
  });
});

describe("a second tick inside the same hour claims nothing twice", () => {
  it("the page is no longer due once the claim has bumped its attempt and its moment", async () => {
    // This is the whole idempotency, and it is on the retry's own due
    // moment rather than on `(draftId, destinationId)` — which is the
    // at-most-once key for a *post*, and would refuse the retry rather
    // than schedule it.
    expect(await dueRetries(after(5))).toHaveLength(1);

    // What the claim does to the row: `failed` to `publishing`,
    // `attempt_no + 1`, `claimed_at = now`.
    const publication = db.rows("publications")[0]!;
    publication.attempt_no = 2;
    publication.claimed_at = after(5).toISOString();
    db.rows("drafts")[0]!.state = "publishing";

    expect(await dueRetries(after(6))).toEqual([]);

    // And after that attempt fails too, it is due again — on the next
    // step, not on this hour.
    publication.delivery_state = "failed";
    db.rows("drafts")[0]!.state = "failed";
    expect(await dueRetries(after(6))).toEqual([]);
    expect(await dueRetries(after(5 + (PUBLISH_RETRY_BACKOFF_MIN[1] ?? 30)))).toHaveLength(1);
  });
});

describe("many pages", () => {
  it("offers each due page once and leaves the rest alone", async () => {
    db.seed("drafts", [
      { id: "d1", site_id: "s1", state: "failed" },
      { id: "d2", site_id: "s1", state: "failed" },
      { id: "d3", site_id: "s1", state: "needs_attention" },
    ]);
    db.seed("publications", [
      { id: "p1", draft_id: "d1", destination: "wordpress", delivery_state: "failed", attempt_no: 1, claimed_at: CLAIMED.toISOString() },
      { id: "p2", draft_id: "d2", destination: "wordpress", delivery_state: "failed", attempt_no: 1, claimed_at: CLAIMED.toISOString() },
      { id: "p3", draft_id: "d3", destination: "wordpress", delivery_state: "failed", attempt_no: 1, claimed_at: CLAIMED.toISOString() },
    ]);
    expect((await dueRetries(after(5))).map((r) => r.draftId)).toEqual(["d1", "d2"]);
  });

  it("nothing due is an empty list, and asks the destinations nothing", async () => {
    seed({ publication: { delivery_state: "delivered" } });
    expect(await dueRetries(after(10_000))).toEqual([]);
    expect(db.queries.filter((q) => q.table === "destinations")).toHaveLength(0);
  });
});
