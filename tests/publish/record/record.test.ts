// tests/publish/record/record.test.ts — the page record: the address under
// the label its current state earns, and the one check's outcome
// inseparable from it.
//
// Three discriminating rows:
//
//   - **the moved fixture.** One page carried through `published →
//     unpublished`: the URL is identical and the label changes. An
//     implementation splitting on `made_live_by_us` — a fact about the past
//     — passes every static fixture and fails this one, and its failure
//     mode is telling a customer that a page ReachKit stopped serving is
//     "publicly readable at" that address.
//   - **the inseparability rows.** `PageRecord` has no optional field, and
//     a caller receiving `state` necessarily receives `verification`. That
//     is the mechanism REQ-062 c7 is held by, not a convention: the promise
//     holds on surfaces that do not exist yet.
//   - **the paired verification fixture.** `could_not_confirm` and
//     `page_not_found` differ only in the recorded arm and must leave this
//     record as two distinguishable values.
//
// The archived plan is WO-263.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";
import { AWAITING_COPY, COPY, TODO_COPY_MARKER } from "@/lib/presentation/copy";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { ADDRESS_COPY, pageRecordFor } = await import("@/lib/publish/record");

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const MEASURED_AT = new Date(Date.UTC(2026, 7, 31, 6, 0, 0));
const CLAIMED_AT = new Date(Date.UTC(2026, 8, 1, 9, 0, 0));
const DUE_AT = new Date(Date.UTC(2026, 8, 2, 9, 0, 0));
const CHECKED_AT = new Date(Date.UTC(2026, 8, 2, 10, 0, 0));
const NOW = new Date(Date.UTC(2026, 8, 3, 10, 0, 0));

const FOUND: Row = {
  outcome: "found",
  checkedAt: CHECKED_AT.toISOString(),
  siteCondition: null,
  checks: Object.fromEntries(
    ["reachable", "indexable", "sitemap", "aiReadable"].map((id) => [
      id,
      { kind: "measured", value: true, at: CHECKED_AT.toISOString() },
    ])
  ),
};

const NOT_FOUND: Row = {
  outcome: "page_not_found",
  status: 410,
  checkedAt: CHECKED_AT.toISOString(),
  siteCondition: null,
};

const NOT_CONFIRMED: Row = {
  outcome: "could_not_confirm",
  why: "redirected_away",
  checkedAt: CHECKED_AT.toISOString(),
  siteCondition: null,
};

function seed(a: { draft?: Row; publication?: Row | null } = {}): void {
  db.reset();
  db.seed("scans", [{ id: "sc1", created_at: MEASURED_AT.toISOString() }]);
  db.seed("opportunities", [
    { id: "o1", scan_id: "sc1", target_query: "how long does a roof last" },
  ]);
  db.seed("drafts", [{ id: "d1", state: "published", opportunity_id: "o1", ...a.draft }]);
  if (a.publication !== null) {
    db.seed("publications", [
      {
        id: "p1",
        draft_id: "d1",
        site_id: "s1",
        destination: "hosted",
        mode: "autopilot",
        made_live_by_us: true,
        unpublish_outcome: null,
        live_url: LIVE_URL,
        published_at: CLAIMED_AT.toISOString(),
        unpublished_at: null,
        claimed_at: CLAIMED_AT.toISOString(),
        verify_due_at: DUE_AT.toISOString(),
        verify: FOUND,
        ...a.publication,
      },
    ]);
  }
}

beforeEach(() => db.reset());

describe("pageRecordFor — REQ-056 c6's five facts", () => {
  it("a published page is shown the opportunity, the search, the measurement date, the mode and the address", async () => {
    seed();
    const record = await pageRecordFor("d1", NOW);
    expect(record).not.toBeNull();
    expect(record!.opportunityId).toBe("o1");
    expect(record!.targetQuery).toBe("how long does a roof last");
    expect(record!.measuredAt).toEqual(MEASURED_AT);
    expect(record!.mode).toBe("autopilot");
    expect(record!.address).toEqual({
      offered: true,
      label: ADDRESS_COPY.publiclyReadableAt,
      url: LIVE_URL,
    });
  });

  it("at both destinations, since ADR-084 both carry an address", async () => {
    for (const destination of ["hosted", "wordpress"]) {
      seed({ publication: { destination } });
      const record = await pageRecordFor("d1", NOW);
      expect(record!.address.offered, destination).toBe(true);
    }
  });

  it("the address is offered as publicly readable only while the page stands published", async () => {
    seed();
    const record = await pageRecordFor("d1", NOW);
    expect(record!.address).toEqual({
      offered: true,
      label: ADDRESS_COPY.publiclyReadableAt,
      url: LIVE_URL,
    });
  });

  it("from the moment it moves to unpublished the same address is presented as the one it was published at", async () => {
    // One fixture carried through the edge: the URL is identical, the
    // label changed, and `made_live_by_us` did not move at all — which is
    // the whole of why the label may not be read from it.
    seed({
      draft: { state: "unpublished" },
      publication: {
        unpublished_at: NOW.toISOString(),
        unpublish_outcome: "removed",
        made_live_by_us: true,
      },
    });
    const record = await pageRecordFor("d1", NOW);
    expect(record!.address).toEqual({
      offered: true,
      label: ADDRESS_COPY.wasPublishedAt,
      url: LIVE_URL,
    });
  });

  it("where ReachKit never made the page live, no address is offered at all", async () => {
    seed({ publication: { made_live_by_us: false, live_url: null } });
    const record = await pageRecordFor("d1", NOW);
    expect(record!.address).toEqual({
      offered: false,
      because: "never_made_live",
      copy: ADDRESS_COPY.neverMadeLive,
    });
    // Not an empty string and not a null: a surface must be unable to
    // render an address it was not given.
    expect(record!.address).not.toHaveProperty("url");
  });

  it("carries the outcome criterion 15 or 16 named, and no other account of what is at that address", async () => {
    for (const outcome of [
      "removed",
      "returned_to_draft",
      "named_for_removal",
      "already_gone",
      "unreachable",
    ]) {
      seed({
        draft: { state: "unpublished" },
        publication: { unpublished_at: NOW.toISOString(), unpublish_outcome: outcome },
      });
      const record = await pageRecordFor("d1", NOW);
      expect(record!.unpublishOutcome, outcome).toBe(outcome);
    }
  });

  it("unpublishOutcome is non-null exactly when the page stands unpublished", async () => {
    seed({ publication: { unpublish_outcome: "removed" } });
    expect((await pageRecordFor("d1", NOW))!.unpublishOutcome).toBeNull();

    seed({
      draft: { state: "unpublished" },
      publication: { unpublished_at: NOW.toISOString(), unpublish_outcome: "already_gone" },
    });
    expect((await pageRecordFor("d1", NOW))!.unpublishOutcome).toBe("already_gone");
  });

  it("no field describes what is at that address today", async () => {
    // ReachKit never goes back to look, so the record carries no derived
    // liveness boolean and no field a surface could read as a fresher
    // observation than the one check.
    seed();
    const record = await pageRecordFor("d1", NOW);
    expect(Object.keys(record!).sort()).toEqual([
      "address",
      "draftId",
      "measuredAt",
      "mode",
      "opportunityId",
      "state",
      "targetQuery",
      "unpublishOutcome",
      "verification",
    ]);
  });
});

describe("pageRecordFor — REQ-062 c7's inseparability (ADR-085 Decision 5)", () => {
  it("the state cannot be obtained without the recorded outcome", async () => {
    seed();
    const record = await pageRecordFor("d1", NOW);
    // The destructuring proof: a caller that receives `state` necessarily
    // receives `verification`, because they are one object with neither
    // field optional.
    const { state, verification } = record!;
    expect(state).toBe("published");
    expect(verification).toBeDefined();

    // And the type-level half: every field is required.
    // @ts-expect-error — `state` may not be omitted
    const withoutState: typeof record = { ...record!, state: undefined };
    // @ts-expect-error — `address` may not be omitted
    const withoutAddress: typeof record = { ...record!, address: undefined };
    // @ts-expect-error — `verification` may not be omitted
    const withoutVerification: typeof record = { ...record!, verification: undefined };
    expect([withoutState, withoutAddress, withoutVerification]).toHaveLength(3);
  });

  it("the whole recorded outcome travels, checkedAt included, for all three arms", async () => {
    for (const verify of [FOUND, NOT_FOUND, NOT_CONFIRMED]) {
      seed({ publication: { verify } });
      const record = await pageRecordFor("d1", NOW);
      expect(record!.verification.kind).toBe("done");
      if (record!.verification.kind !== "done") throw new Error("unreachable");
      expect(record!.verification.result.outcome).toBe(verify.outcome);
      expect(record!.verification.result.checkedAt).toEqual(CHECKED_AT);
    }
  });

  it("a could_not_confirm record and a page_not_found record are distinguishable on the returned value alone", async () => {
    // One fixture pair, identical but for the recorded arm. This is the row
    // that fails when the two are collapsed into one grey line: a
    // `could_not_confirm` record's state is unchanged and the page goes on
    // being judged, while `page_not_found` is the one whose liveness stops
    // being claimed.
    seed({ publication: { verify: NOT_CONFIRMED } });
    const notConfirmed = await pageRecordFor("d1", NOW);
    seed({ publication: { verify: NOT_FOUND } });
    const notFound = await pageRecordFor("d1", NOW);

    expect(notConfirmed!.state).toBe("published");
    expect(notFound!.state).toBe("published");
    expect(notConfirmed!.verification).not.toEqual(notFound!.verification);
    if (notConfirmed!.verification.kind !== "done") throw new Error("unreachable");
    if (notFound!.verification.kind !== "done") throw new Error("unreachable");
    expect(notConfirmed!.verification.result).not.toHaveProperty("status");
    expect(notFound!.verification.result).not.toHaveProperty("why");
  });

  it("a check that has not run is a disposition, never an outcome", async () => {
    seed({ publication: { verify: null } });
    expect((await pageRecordFor("d1", new Date(Date.UTC(2026, 8, 2, 8, 0))))!.verification).toEqual({
      kind: "not_yet",
      dueAt: DUE_AT,
    });
    expect((await pageRecordFor("d1", NOW))!.verification).toEqual({ kind: "due" });
  });

  it("a draft that was never published has a record, and its verification says so", async () => {
    seed({ draft: { state: "in_review" }, publication: null });
    const record = await pageRecordFor("d1", NOW);
    expect(record!.state).toBe("in_review");
    expect(record!.verification).toEqual({ kind: "never", because: "no_live_address" });
    expect(record!.address.offered).toBe(false);
  });

  it("a draft that does not exist is null", async () => {
    db.reset();
    expect(await pageRecordFor("nope", NOW)).toBeNull();
  });
});

describe("the record's own shape", () => {
  it("names three copy keys and writes no sentence", async () => {
    for (const key of Object.values(ADDRESS_COPY)) {
      expect(COPY[key]).toBe(TODO_COPY_MARKER);
      expect(AWAITING_COPY).toContain(key);
    }
  });

  it("is read-only: it writes no row and takes no transition", async () => {
    seed();
    await pageRecordFor("d1", NOW);
    expect(db.queries.every((q) => q.verb === "select")).toBe(true);
    expect(db.rpcCalls).toEqual([]);
  });
});
