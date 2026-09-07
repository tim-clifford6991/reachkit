// tests/market/changes/declared.test.ts — BUILD §4.7, REQ-071, ADR-030
//
// The two reads a pending change is the difference between.
//
// The mutation these rows kill is the one ADR-030 is written against:
// reading the *declared* answer where the *measured* one belongs. That
// makes every number on screen claim it was measured under the answer the
// customer saved a minute ago, which is exactly the movement across a
// change REQ-071 c12 and c13 forbid.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, scan, site } from "./harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { declaredAnswers, declaredTimezone, measuredAnswers, NoSuchSiteError, storedDomains } =
  await import("@/lib/market/changes/declared");

beforeEach(() => {
  db.reset();
  db.seed("sites", [site()]);
  db.seed("scans", [scan()]);
});

describe("the declared answers — what the site is measured against from now on", () => {
  it("reads the three answers off `sites`", async () => {
    await expect(declaredAnswers("site-1")).resolves.toEqual({
      domain: "acme.test",
      category: "project management software",
      rivals: ["asana.com", "monday.com"],
    });
  });

  it("a site with no category reads `null`, never an empty category", async () => {
    db.seed("sites", [site({ category: null })]);
    await expect(declaredAnswers("site-1")).resolves.toMatchObject({ category: null });
  });

  it("an empty rival set is an answer, not a missing one (REQ-071 c16)", async () => {
    db.seed("sites", [site({ competitors: [] })]);
    await expect(declaredAnswers("site-1")).resolves.toMatchObject({ rivals: [] });
  });

  it("a site that does not exist throws — a missing row is a fault, not `measured against nothing`", async () => {
    await expect(declaredAnswers("no-such-site")).rejects.toBeInstanceOf(NoSuchSiteError);
  });

  it("the stored list is read defensively: the column admits only strings", () => {
    expect(storedDomains(["asana.com", 7, null, "asana.com", "monday.com"])).toEqual([
      "asana.com",
      "monday.com",
    ]);
    expect(storedDomains("not a list")).toEqual([]);
    expect(storedDomains(null)).toEqual([]);
  });

  it("the stated zone is read as stated, and `null` where none is (REQ-073 c1)", async () => {
    await expect(declaredTimezone("site-1")).resolves.toBe("America/New_York");
    db.seed("sites", [site({ timezone: null })]);
    await expect(declaredTimezone("site-1")).resolves.toBeNull();
  });
});

describe("the measured answers — what the numbers on screen were measured against", () => {
  it("reads the current scan's own answers and its own date", async () => {
    await expect(measuredAnswers("site-1")).resolves.toEqual({
      domain: "acme.test",
      category: "project management software",
      rivals: ["asana.com", "monday.com"],
      at: new Date("2026-09-07T06:00:00.000Z"),
      scanId: "scan-1",
    });
  });

  it("the *current* scan and no other — a superseded scan is not what the screen shows", async () => {
    db.seed("scans", [
      scan({ id: "old", is_current: false, domain: "old.test", created_at: "2026-08-01T06:00:00.000Z" }),
      scan({ id: "now", is_current: true }),
    ]);
    await expect(measuredAnswers("site-1")).resolves.toMatchObject({
      scanId: "now",
      domain: "acme.test",
    });
  });

  it("another site's current scan is never this site's", async () => {
    db.seed("scans", [scan({ site_id: "site-other" })]);
    await expect(measuredAnswers("site-1")).resolves.toBeNull();
  });

  it("a site with nothing measured yet is `null` — a real state, not a failure", async () => {
    db.seed("scans", []);
    await expect(measuredAnswers("site-1")).resolves.toBeNull();
  });

  it("the date is the measurement's own, never the row's creation where the blob states one", async () => {
    db.seed("scans", [scan({ measuredAt: "2026-08-31T06:00:00.000Z", created_at: "2026-09-07T06:00:00.000Z" })]);
    await expect(measuredAnswers("site-1")).resolves.toMatchObject({
      at: new Date("2026-08-31T06:00:00.000Z"),
    });
  });

  it("a blob with no verdict date falls back to when the pass began, never to now", async () => {
    db.seed("scans", [
      { ...scan(), report: { category: "x", presence: { rivals: [] } }, created_at: "2026-08-24T06:00:00.000Z" },
    ]);
    await expect(measuredAnswers("site-1")).resolves.toMatchObject({
      at: new Date("2026-08-24T06:00:00.000Z"),
    });
  });

  it("a blob with no presence card measured against no rivals — not against the declared ones", async () => {
    db.seed("scans", [{ ...scan(), report: { category: "x", verdict: { measuredAt: "2026-09-07T06:00:00.000Z" } } }]);
    await expect(measuredAnswers("site-1")).resolves.toMatchObject({ rivals: [] });
  });
});

describe("the two reads are two reads", () => {
  it("a saved answer does not change what the current scan says it measured", async () => {
    // The whole of ADR-030 in one row: the declared answer moves, the
    // measured answer does not, and their difference is the pending change.
    db.rows("sites")[0]!.category = "agency project management";
    const declared = await declaredAnswers("site-1");
    const measured = await measuredAnswers("site-1");
    expect(declared.category).toBe("agency project management");
    expect(measured?.category).toBe("project management software");
  });
});
