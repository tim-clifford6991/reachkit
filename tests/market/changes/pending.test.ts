// tests/market/changes/pending.test.ts — BUILD §4.7, REQ-071, ADR-030
//
// Pending is a computation, and this is where that is proved.
//
// The mutations these rows kill: a pending change that survives the pass
// that resolved it (it cannot — there is no state to survive); an effective
// date computed by adding seven days rather than asking the weekly clock
// (a DST week is not 168 hours); and a rival edit holding page generation,
// which would stop a customer's pages for a week over a change that does
// not touch what a page is about.
import { describe, expect, it } from "vitest";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

const { effectiveOn, generationHold, pendingChanges } = await import(
  "@/lib/market/changes/pending"
);

const ZONE = "America/New_York";

const declared: { domain: string; category: string | null; rivals: readonly string[] } = {
  domain: "acme.com",
  category: "project management software",
  rivals: ["asana.com", "monday.com"],
};

const measured: {
  domain: string;
  category: string | null;
  rivals: readonly string[];
  at: Date;
  scanId: string;
} = {
  domain: "acme.com",
  category: "project management software",
  rivals: ["asana.com", "monday.com"],
  at: new Date("2026-09-07T10:00:00.000Z"),
  scanId: "scan-1",
};

/** A Tuesday, so "the next Monday" is unambiguous in either direction. */
const TUESDAY = new Date("2026-09-08T15:00:00.000Z");

function pending(over: { declared?: Partial<typeof declared>; measured?: Partial<typeof measured> | null }) {
  return pendingChanges({
    declared: { ...declared, ...over.declared },
    measured: over.measured === null ? null : { ...measured, ...over.measured },
    now: TUESDAY,
    timezone: ZONE,
  });
}

describe("a pending change is the difference between the two answers", () => {
  it("two answers that agree are nothing pending", () => {
    expect(pending({})).toEqual([]);
  });

  it("a changed domain is one pending change, carrying both values", () => {
    const changes = pending({ declared: { domain: "newname.com" } });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "domain",
      declared: "newname.com",
      measured: "acme.com",
    });
  });

  it("a changed category is one, and a changed rival set is one", () => {
    expect(pending({ declared: { category: "agency work" } }).map((c) => c.kind)).toEqual([
      "category",
    ]);
    expect(pending({ declared: { rivals: ["asana.com"] } }).map((c) => c.kind)).toEqual(["rivals"]);
  });

  it("all three at once are three, and every one lands at the same pass", () => {
    const changes = pending({
      declared: { domain: "newname.com", category: "agency work", rivals: [] },
    });
    expect(changes.map((c) => c.kind)).toEqual(["domain", "category", "rivals"]);
    const dates = new Set(changes.map((c) => c.effectiveOn.getTime()));
    expect(dates.size).toBe(1);
  });

  it("**it clears itself**: once the pass has measured the new answers, nothing is pending", () => {
    // ADR-030 point 4, asserted. No transition ran and no row was deleted —
    // the new scan is current and the difference is gone.
    const changes = pendingChanges({
      declared: { ...declared, category: "agency work" },
      measured: { ...measured, category: "agency work", scanId: "scan-2" },
      now: TUESDAY,
      timezone: ZONE,
    });
    expect(changes).toEqual([]);
  });

  it("a site with nothing measured yet has nothing pending, not three changes", () => {
    // Between setup and the first pass there is no old answer for the new
    // one to differ from — and reading it as three would hold generation on
    // a site that has never been measured.
    expect(pending({ measured: null })).toEqual([]);
  });

  it("a category nobody has named is not a change away from one", () => {
    expect(pending({ declared: { category: null }, measured: { category: null } })).toEqual([]);
    expect(pending({ measured: { category: null } })).toEqual([]);
  });

  it("reordering the rival set is not a change — the set is what a pass compares", () => {
    expect(pending({ declared: { rivals: ["monday.com", "asana.com"] } })).toEqual([]);
  });

  it("removing the last rival is a change (REQ-071 c16)", () => {
    expect(pending({ declared: { rivals: [] } }).map((c) => c.kind)).toEqual(["rivals"]);
  });
});

describe("REQ-065 c1 — the effective date is the next weekly re-measurement, in the customer's own zone", () => {
  it("a save on a Tuesday lands on the following Monday", () => {
    const on = effectiveOn({ savedAt: TUESDAY, timezone: ZONE });
    expect(on.getTime()).toBeGreaterThan(TUESDAY.getTime());
    expect(on.toISOString().slice(0, 10)).toBe("2026-09-14");
  });

  it("the zone is the customer's: two zones can name two different instants", () => {
    const newYork = effectiveOn({ savedAt: TUESDAY, timezone: "America/New_York" });
    const tokyo = effectiveOn({ savedAt: TUESDAY, timezone: "Asia/Tokyo" });
    expect(newYork.getTime()).not.toBe(tokyo.getTime());
  });

  it("it is never in the past, whatever the moment of the save", () => {
    for (const at of [
      "2026-09-07T09:00:00.000Z",
      "2026-09-07T23:59:00.000Z",
      "2026-09-13T23:59:00.000Z",
      "2026-11-01T05:30:00.000Z",
    ]) {
      const savedAt = new Date(at);
      expect(effectiveOn({ savedAt, timezone: ZONE }).getTime(), at).toBeGreaterThan(
        savedAt.getTime()
      );
    }
  });

  it("a week containing a DST transition is not 168 hours, and the date still lands on the site's Monday", () => {
    // The US autumn transition is 2026-11-01. A `+7 days` computation puts
    // the answer an hour out; asking the weekly clock does not.
    const savedAt = new Date("2026-10-27T15:00:00.000Z");
    const on = effectiveOn({ savedAt, timezone: ZONE });
    const spanHours = (on.getTime() - savedAt.getTime()) / 3_600_000;
    expect(on.toISOString().slice(0, 10)).toBe("2026-11-02");
    expect(Math.round(spanHours)).not.toBe(24 * 7);
  });
});

describe("REQ-071 c11 — which changes hold page generation, and which do not", () => {
  it("nothing pending holds nothing", () => {
    expect(generationHold([])).toEqual({ held: false });
  });

  it("a domain change holds generation, and names the date pages resume", () => {
    const changes = pending({ declared: { domain: "newname.com" } });
    expect(generationHold(changes)).toEqual({
      held: true,
      because: "domain",
      resumesOn: changes[0]!.effectiveOn,
    });
  });

  it("a category change holds generation", () => {
    expect(generationHold(pending({ declared: { category: "agency work" } }))).toMatchObject({
      held: true,
      because: "category",
    });
  });

  it("**a rival change does not hold generation**", () => {
    // The criterion names the domain and the category and no third. A rival
    // set changes who a page is compared against, not what it is about —
    // holding on it would stop a customer's pages for a week over an edit
    // that cannot make a page wrong.
    expect(generationHold(pending({ declared: { rivals: ["asana.com"] } }))).toEqual({
      held: false,
    });
  });

  it("a domain change outranks a category change: the day's line names one reason, never two", () => {
    const changes = pending({ declared: { domain: "newname.com", category: "agency work" } });
    expect(generationHold(changes)).toMatchObject({ because: "domain" });
  });

  it("the resume date is the change's own effective date, not a second computation", () => {
    const changes = pending({ declared: { category: "agency work" } });
    const hold = generationHold(changes);
    expect(hold.held && hold.resumesOn).toEqual(changes[0]!.effectiveOn);
  });
});
