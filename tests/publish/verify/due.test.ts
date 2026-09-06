// tests/publish/verify/due.test.ts — when the 24-hour check is due, and the
// two ways it never will be.
//
// The three discriminating rows:
//
//   1. a null live address is excluded **whatever the destination kind** —
//      including a WordPress row and a kind nothing has invented yet — and
//      a WordPress row that *has* an address is not excluded. That pair
//      fails against any implementation that kept the destination-kind
//      rule, which since ADR-084 would silently exclude every WordPress
//      page from the check REQ-062 c1 promises it.
//   2. all three recorded outcomes are absent from `dueNow` and stay
//      absent. `could_not_confirm` is the one that matters: ADR-085's
//      warning block leads with the retry, which is the single most likely
//      wrong change anyone will make here, reads as a bug fix, and passes
//      every other row in this file.
//   3. a page taken down before its check was due runs no check and its row
//      is **not deleted** — deleting it re-arms the duplicate post ADR-080
//      exists to refuse.
//
// The archived plan is WO-232.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, type Row } from "../harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { dispositionFor, dueNow } = await import("@/lib/publish/verify/due");

const PUBLISHED_AT = new Date(Date.UTC(2026, 8, 1, 9, 0, 0));
const DUE_AT = new Date(Date.UTC(2026, 8, 2, 9, 0, 0));
const BEFORE_DUE = new Date(Date.UTC(2026, 8, 2, 8, 0, 0));
const AFTER_DUE = new Date(Date.UTC(2026, 8, 2, 10, 0, 0));
const CHECKED_AT = new Date(Date.UTC(2026, 8, 2, 10, 5, 0));

function publication(over: Row = {}): Row {
  return {
    id: "p1",
    draft_id: "d1",
    site_id: "s1",
    destination: "hosted",
    live_url: "https://content.example.com/roof",
    published_at: PUBLISHED_AT.toISOString(),
    unpublished_at: null,
    verify_due_at: DUE_AT.toISOString(),
    verify: null,
    ...over,
  };
}

function storedFound(): Row {
  const at = CHECKED_AT.toISOString();
  const yes = { kind: "measured", value: true, at };
  return {
    outcome: "found",
    checkedAt: at,
    siteCondition: null,
    checks: { reachable: yes, indexable: yes, sitemap: yes, aiReadable: yes },
  };
}

function storedNotFound(): Row {
  return {
    outcome: "page_not_found",
    status: 404,
    checkedAt: CHECKED_AT.toISOString(),
    siteCondition: null,
  };
}

function storedNotConfirmed(): Row {
  return {
    outcome: "could_not_confirm",
    why: "server_error",
    checkedAt: CHECKED_AT.toISOString(),
    siteCondition: null,
  };
}

beforeEach(() => {
  db.reset();
});

describe("dispositionFor — the dispositions of one publication's check", () => {
  it("in the 24 hours before the check runs it is not_yet, carrying when it will run", () => {
    // REQ-062 c3: the four outcomes state that they have not been checked
    // yet **and when they will be**, never that they passed or failed.
    db.seed("publications", [publication()]);
    return dispositionFor("p1", BEFORE_DUE).then((d) => {
      expect(d).toEqual({ kind: "not_yet", dueAt: DUE_AT });
      expect(d).not.toHaveProperty("result");
    });
  });

  it("at the due moment it is due", async () => {
    db.seed("publications", [publication()]);
    expect(await dispositionFor("p1", AFTER_DUE)).toEqual({ kind: "due" });
  });

  it("a page taken down before its check was due runs no check and states so", async () => {
    db.seed("publications", [
      publication({ unpublished_at: new Date(Date.UTC(2026, 8, 1, 18, 0, 0)).toISOString() }),
    ]);
    expect(await dispositionFor("p1", AFTER_DUE)).toEqual({
      kind: "never",
      because: "taken_down_first",
    });
  });

  it("the publication row of a never-verified page is not deleted", async () => {
    // ADR-080 decision 2: a row for a page that was never verified reads
    // as stale data, and deleting it silently re-arms the duplicate post
    // the at-most-once guarantee forbids.
    db.seed("publications", [
      publication({ unpublished_at: new Date(Date.UTC(2026, 8, 1, 18, 0, 0)).toISOString() }),
    ]);
    await dispositionFor("p1", AFTER_DUE);
    expect(db.rows("publications")).toHaveLength(1);
    expect(db.queries.some((q) => q.verb === "update")).toBe(false);
  });

  it("a page taken down after its check was due is still due — the check is not cancelled by a later act", async () => {
    db.seed("publications", [
      publication({ unpublished_at: new Date(Date.UTC(2026, 8, 2, 12, 0, 0)).toISOString() }),
    ]);
    expect(await dispositionFor("p1", AFTER_DUE)).toEqual({ kind: "due" });
  });

  it("a null live address is no_live_address whatever the destination kind", async () => {
    // The seam that held. The rule is written against the **address**, not
    // the kind: `if (kind === 'wordpress')` would now silently exclude
    // every WordPress page from the check c1 promises it.
    for (const destination of ["hosted", "wordpress", "some-third-kind"]) {
      db.reset();
      db.seed("publications", [
        publication({ destination, live_url: null, verify_due_at: null }),
      ]);
      expect(await dispositionFor("p1", AFTER_DUE), destination).toEqual({
        kind: "never",
        because: "no_live_address",
      });
    }
  });

  it("a WordPress row that has an address is not excluded — it is due like any other", async () => {
    db.seed("publications", [
      publication({ destination: "wordpress", live_url: "https://customer.example/post" }),
    ]);
    expect(await dispositionFor("p1", AFTER_DUE)).toEqual({ kind: "due" });
  });

  it("the disposition carries the whole recorded outcome, checkedAt included", async () => {
    db.seed("publications", [publication({ verify: storedFound() })]);
    const disposition = await dispositionFor("p1", AFTER_DUE);
    expect(disposition.kind).toBe("done");
    if (disposition.kind !== "done") throw new Error("unreachable");
    expect(disposition.result.outcome).toBe("found");
    expect(disposition.result.checkedAt).toEqual(CHECKED_AT);
    if (disposition.result.outcome !== "found") throw new Error("unreachable");
    expect(disposition.result.checks.reachable).toEqual({
      kind: "measured",
      value: true,
      at: CHECKED_AT,
    });
  });

  it("page_not_found and could_not_confirm come back as two distinguishable values", async () => {
    db.seed("publications", [publication({ verify: storedNotFound() })]);
    const notFound = await dispositionFor("p1", AFTER_DUE);
    db.reset();
    db.seed("publications", [publication({ verify: storedNotConfirmed() })]);
    const notConfirmed = await dispositionFor("p1", AFTER_DUE);

    expect(notFound).toEqual({
      kind: "done",
      result: { outcome: "page_not_found", status: 404, checkedAt: CHECKED_AT },
    });
    expect(notConfirmed).toEqual({
      kind: "done",
      result: { outcome: "could_not_confirm", why: "server_error", checkedAt: CHECKED_AT },
    });
    expect(notFound).not.toEqual(notConfirmed);
  });

  it("neither of those two arms carries the four checks", async () => {
    for (const stored of [storedNotFound(), storedNotConfirmed()]) {
      db.reset();
      db.seed("publications", [publication({ verify: stored })]);
      const disposition = await dispositionFor("p1", AFTER_DUE);
      if (disposition.kind !== "done") throw new Error("unreachable");
      expect(disposition.result).not.toHaveProperty("checks");
    }
  });

  it("a payload nothing in this product wrote leaves the check unrecorded rather than inventing an arm", async () => {
    db.seed("publications", [publication({ verify: { outcome: "something_else" } })]);
    expect(await dispositionFor("p1", AFTER_DUE)).toEqual({ kind: "due" });
  });
});

describe("dueNow — a recorded outcome is never due again (ADR-085)", () => {
  it("selects rows whose check has fallen due, oldest first", async () => {
    db.seed("publications", [
      publication({ id: "p-late", verify_due_at: new Date(Date.UTC(2026, 8, 2, 8, 0)).toISOString() }),
      publication({ id: "p-early", verify_due_at: new Date(Date.UTC(2026, 8, 1, 8, 0)).toISOString() }),
    ]);
    expect(await dueNow(10, AFTER_DUE)).toEqual(["p-early", "p-late"]);
  });

  it("never returns a row whose check is not yet due", async () => {
    db.seed("publications", [publication()]);
    expect(await dueNow(10, BEFORE_DUE)).toEqual([]);
  });

  it("never returns a row with no due moment at all", async () => {
    db.seed("publications", [publication({ live_url: null, verify_due_at: null })]);
    expect(await dueNow(10, AFTER_DUE)).toEqual([]);
  });

  it("a crashed run left the row due — the job is idempotent by the null check alone", async () => {
    db.seed("publications", [publication()]);
    expect(await dueNow(10, AFTER_DUE)).toEqual(["p1"]);
    expect(await dueNow(10, AFTER_DUE)).toEqual(["p1"]);
  });

  it("no further check is run, for any of the three recorded outcomes — then or at any later tick", async () => {
    // The `could_not_confirm` row is the discriminating one. A transport
    // failure at 24 hours *is* a flake and retrying flakes is what good
    // code does; it is forbidden here because there is no second look, and
    // a retry that succeeded an hour later would record a different day's
    // fact under the check's own date.
    for (const stored of [storedFound(), storedNotFound(), storedNotConfirmed()]) {
      db.reset();
      db.seed("publications", [publication({ verify: stored })]);
      expect(await dueNow(10, AFTER_DUE)).toEqual([]);
      expect(await dueNow(10, new Date(Date.UTC(2026, 11, 25, 0, 0)))).toEqual([]);
      expect(await dueNow(10, new Date(Date.UTC(2027, 5, 25, 0, 0)))).toEqual([]);
    }
  });

  it("selects on the recorded outcome and the due moment and on nothing else — no backoff, no attempt counter", async () => {
    db.seed("publications", [publication()]);
    await dueNow(5, AFTER_DUE);
    const query = db.queries.at(-1)!;
    expect(query.table).toBe("publications");
    expect(query.filters.map((f) => `${f.op}:${f.column}`)).toEqual([
      "is-null:verify",
      "lte:verify_due_at",
    ]);
  });
});
