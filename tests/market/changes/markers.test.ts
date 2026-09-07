// tests/market/changes/markers.test.ts — BUILD §4.7, REQ-071 c12/c13
//
// The dates every series, verdict and week count breaks at.
//
// REQ-071 c12 and c13 forbid presenting the difference across a change as
// movement in any form. That promise is only as good as the dates a chart
// is told to break at, so the mutations these rows kill are: a marker on
// the *earlier* scan of a changed pair (which breaks the wrong gap, joining
// the first new measurement to the last old one); a marker on the first
// scan a site ever took (an answer did not change on the day measuring
// began); and a week count that spans a domain change (a number about two
// different sites).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb, scan } from "./harness";

const db = fakeDb();
vi.mock("@/lib/db", () => ({ dbAdmin: () => db.client, db: () => db.client }));

const { changeMarkers, domainHistory, weeksMeasured } = await import(
  "@/lib/market/changes/markers"
);

const ALL = { siteId: "site-1", from: new Date("2020-01-01"), to: new Date("2030-01-01") };

/** A week's scan, with the two answers it was measured under. */
function week(
  n: number,
  over: { domain?: string; category?: string | null; status?: string; site?: string } = {}
): Record<string, unknown> {
  // One scan per day in August 2026, so `week(3)` is plainly 2026-08-03.
  const at = `2026-08-${String(n).padStart(2, "0")}T06:00:00.000Z`;
  return scan({
    id: `scan-${n}`,
    site_id: over.site ?? "site-1",
    domain: over.domain ?? "acme.com",
    status: over.status ?? "done",
    is_current: false,
    created_at: at,
    measuredAt: at,
    category: over.category === undefined ? "project management" : over.category,
  });
}

beforeEach(() => {
  db.reset();
});

describe("a marker sits on the first measurement taken under the new answer", () => {
  it("a domain change is marked on the later scan, never the earlier one", async () => {
    db.seed("scans", [week(1), week(2), week(3, { domain: "newname.com" })]);
    const markers = await changeMarkers(ALL);
    expect(markers).toEqual([{ kind: "domain", on: new Date("2026-08-03T06:00:00.000Z") }]);
  });

  it("a category change is marked the same way", async () => {
    db.seed("scans", [week(1), week(2, { category: "agency work" })]);
    const markers = await changeMarkers(ALL);
    expect(markers).toEqual([{ kind: "category", on: new Date("2026-08-02T06:00:00.000Z") }]);
  });

  it("both changing at one pass gives two markers on that date", async () => {
    db.seed("scans", [week(1), week(2, { domain: "newname.com", category: "agency work" })]);
    const markers = await changeMarkers(ALL);
    expect(markers.map((m) => m.kind)).toEqual(["domain", "category"]);
    expect(new Set(markers.map((m) => m.on.getTime())).size).toBe(1);
  });

  it("the first scan carries no marker — nothing preceded it, so there is no gap", async () => {
    db.seed("scans", [week(1)]);
    await expect(changeMarkers(ALL)).resolves.toEqual([]);
  });

  it("a site measured against one answer throughout has no markers", async () => {
    db.seed("scans", [week(1), week(2), week(3)]);
    await expect(changeMarkers(ALL)).resolves.toEqual([]);
  });

  it("a category nobody named on one side is not a change", async () => {
    db.seed("scans", [week(1, { category: null }), week(2)]);
    await expect(changeMarkers(ALL)).resolves.toEqual([]);
  });

  it("**a rival change is not a marker**", async () => {
    // c12 and c13 break series at a question-set change and a domain
    // change. A rival edit changes who a page is compared against, and c8's
    // rule is that the comparison simply shows the current set from the
    // next re-measurement — breaking every chart on it would state a
    // discontinuity the requirement does not claim.
    const withRivals = { ...week(2) } as Record<string, unknown>;
    withRivals.report = {
      category: "project management",
      verdict: { measuredAt: "2026-08-02T06:00:00.000Z" },
      presence: { rivals: [{ domain: "clickup.com" }] },
    };
    db.seed("scans", [week(1), withRivals]);
    await expect(changeMarkers(ALL)).resolves.toEqual([]);
  });
});

describe("what a marker may be derived from", () => {
  it("a scan that measured nothing cannot carry one", async () => {
    // A `running` scan has measured nothing yet and a `failed` one never
    // will: a marker on either would break a chart at a date no number was
    // measured on.
    db.seed("scans", [
      week(1),
      week(2, { domain: "newname.com", status: "running" }),
      week(3, { domain: "newname.com", status: "failed" }),
    ]);
    await expect(changeMarkers(ALL)).resolves.toEqual([]);
  });

  it("a degraded scan measured something, so it can", async () => {
    db.seed("scans", [week(1), week(2, { domain: "newname.com", status: "degraded" })]);
    await expect(changeMarkers(ALL)).resolves.toHaveLength(1);
  });

  it("another site's scans are never this site's markers", async () => {
    db.seed("scans", [week(1), week(2, { domain: "newname.com", site: "site-other" })]);
    await expect(changeMarkers(ALL)).resolves.toEqual([]);
  });

  it("the range bounds which markers come back, and the comparison still reaches across it", async () => {
    db.seed("scans", [week(1), week(2, { domain: "newname.com" }), week(3, { domain: "newname.com" })]);
    const inside = await changeMarkers({
      siteId: "site-1",
      from: new Date("2026-08-02T00:00:00.000Z"),
      to: new Date("2030-01-01"),
    });
    expect(inside).toHaveLength(1);
    const after = await changeMarkers({
      siteId: "site-1",
      from: new Date("2026-08-10T00:00:00.000Z"),
      to: new Date("2030-01-01"),
    });
    expect(after).toEqual([]);
  });
});

describe("REQ-071 c13 — every number carries the domain it measured", () => {
  it("the history is every domain in order, with the date each was first measured under", async () => {
    db.seed("scans", [week(1), week(2), week(3, { domain: "newname.com" })]);
    await expect(domainHistory("site-1")).resolves.toEqual([
      { domain: "acme.com", firstMeasuredAt: new Date("2026-08-01T06:00:00.000Z") },
      { domain: "newname.com", firstMeasuredAt: new Date("2026-08-03T06:00:00.000Z") },
    ]);
  });

  it("a domain returned to is a new entry, not the old one", async () => {
    // The weeks between were measured under something else, and joining
    // them would be exactly the movement across a change c13 forbids.
    db.seed("scans", [week(1), week(2, { domain: "newname.com" }), week(3)]);
    const history = await domainHistory("site-1");
    expect(history.map((h) => h.domain)).toEqual(["acme.com", "newname.com", "acme.com"]);
  });

  it("a site with nothing measured has no history", async () => {
    await expect(domainHistory("site-1")).resolves.toEqual([]);
  });
});

describe("REQ-071 c13 — the week count starts at the current domain's first measurement", () => {
  it("counts only the weeks measured under the domain the site holds now", async () => {
    db.seed("scans", [week(1), week(2), week(3, { domain: "newname.com" }), week(4, { domain: "newname.com" })]);
    await expect(weeksMeasured("site-1")).resolves.toBe(2);
  });

  it("a site that never changed domain counts them all", async () => {
    db.seed("scans", [week(1), week(2), week(3)]);
    await expect(weeksMeasured("site-1")).resolves.toBe(3);
  });

  it("a site with nothing measured counts none", async () => {
    await expect(weeksMeasured("site-1")).resolves.toBe(0);
  });

  it("a count never spans a change — it is a number about one site, not two", async () => {
    db.seed("scans", [week(1), week(2), week(3), week(4, { domain: "newname.com" })]);
    await expect(weeksMeasured("site-1")).resolves.toBe(1);
  });
});
