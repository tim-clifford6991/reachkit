// tests/app/calendar/ways.test.ts — REQ-043 criterion 12's first way
// through, decided from the stored page record alone.
//
// The landmine row is the pair that differs **only** in the stored outcome:
// `could_not_confirm` leaves the way offered and `page_not_found` refuses
// it. One leaves the page fully judged, the other retires it — and they
// render as the same grey line, which is why refusing on both looks like
// tidying and passes every other row in this file.
//
// The archived plan is WO-258; the second way, inside the customer's own
// WordPress, is issue #54's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AWAITING_COPY, COPY, TODO_COPY_MARKER } from "@/lib/presentation/copy";
import type { PageRecord } from "@/lib/publish/record";
import type { VerifyDisposition } from "@/lib/publish/types";
import { REFUSAL_COPY, wayAsVisitor } from "@/app/(account)/app/calendar/ways";

const LIVE_URL = "https://example.com/how-long-does-a-roof-last";
const CHECKED_AT = new Date(Date.UTC(2026, 8, 2, 10, 0, 0));
const DUE_AT = new Date(Date.UTC(2026, 8, 2, 9, 0, 0));

const FOUND: VerifyDisposition = {
  kind: "done",
  result: {
    outcome: "found",
    checkedAt: CHECKED_AT,
    checks: {
      reachable: { kind: "measured", value: true, at: CHECKED_AT },
      indexable: { kind: "measured", value: false, at: CHECKED_AT },
      sitemap: { kind: "measured", value: true, at: CHECKED_AT },
      aiReadable: { kind: "measured", value: true, at: CHECKED_AT },
    },
  },
};

const PAGE_NOT_FOUND: VerifyDisposition = {
  kind: "done",
  result: { outcome: "page_not_found", status: 404, checkedAt: CHECKED_AT },
};

const COULD_NOT_CONFIRM: VerifyDisposition = {
  kind: "done",
  result: { outcome: "could_not_confirm", why: "unreachable", checkedAt: CHECKED_AT },
};

function record(over: Partial<PageRecord> = {}): PageRecord {
  return {
    draftId: "d1",
    state: "published",
    opportunityId: "o1",
    targetQuery: "how long does a roof last",
    measuredAt: new Date(Date.UTC(2026, 7, 31, 6, 0)),
    mode: "autopilot",
    address: { offered: true, label: "record.address.publiclyReadableAt", url: LIVE_URL },
    unpublishOutcome: null,
    verification: FOUND,
    // REQ-060 c4's line is the page record's, and this surface never
    // renders it (issue #156).
    seoNote: null,
    ...over,
  };
}

describe("wayAsVisitor — the page as a visitor sees it (REQ-043 c12)", () => {
  it("a published page whose check recorded found is offered, at the record's own address", () => {
    expect(wayAsVisitor(record())).toEqual({ offered: true, href: LIVE_URL });
  });

  it("a page whose check recorded page_not_found is refused with that ground", () => {
    expect(wayAsVisitor(record({ verification: PAGE_NOT_FOUND }))).toEqual({
      offered: false,
      because: "page_not_found",
      copy: REFUSAL_COPY.page_not_found,
    });
  });

  it("a page ReachKit unpublished itself is refused with that ground", () => {
    expect(
      wayAsVisitor(
        record({
          state: "unpublished",
          unpublishOutcome: "removed",
          address: { offered: true, label: "record.address.wasPublishedAt", url: LIVE_URL },
        })
      )
    ).toEqual({
      offered: false,
      because: "unpublished_by_us",
      copy: REFUSAL_COPY.unpublished_by_us,
    });
  });

  it("a page that is both takes ReachKit's own act — criterion 12's own order", () => {
    expect(
      wayAsVisitor(
        record({
          state: "unpublished",
          unpublishOutcome: "removed",
          verification: PAGE_NOT_FOUND,
          address: { offered: true, label: "record.address.wasPublishedAt", url: LIVE_URL },
        })
      )
    ).toMatchObject({ offered: false, because: "unpublished_by_us" });
  });

  it("a page whose check could not be confirmed is OFFERED — indistinguishable from the found case", () => {
    // The landmine row. The two records differ only in the stored outcome;
    // refusing on `could_not_confirm` takes a page the record says nothing
    // against and tells the customer the way leads nowhere. It renders as
    // the same grey line as the correct behaviour, so nothing else in this
    // file would notice.
    const offeredOnFound = wayAsVisitor(record({ verification: FOUND }));
    const offeredOnUnconfirmed = wayAsVisitor(record({ verification: COULD_NOT_CONFIRM }));
    expect(offeredOnUnconfirmed).toEqual({ offered: true, href: LIVE_URL });
    expect(offeredOnUnconfirmed).toEqual(offeredOnFound);
  });

  it("every disposition that is not a recorded page_not_found leaves the way offered", () => {
    const dispositions: VerifyDisposition[] = [
      { kind: "not_yet", dueAt: DUE_AT },
      { kind: "due" },
      { kind: "never", because: "taken_down_first" },
      { kind: "never", because: "no_live_address" },
      COULD_NOT_CONFIRM,
      FOUND,
    ];
    for (const verification of dispositions) {
      expect(wayAsVisitor(record({ verification })), verification.kind).toEqual({
        offered: true,
        href: LIVE_URL,
      });
    }
  });

  it("a failed check is not a refusal: the way is offered and claims only where the page was put", () => {
    // `indexable` is a measured false in the `found` fixture and the way
    // is still offered — a check the page did not pass is a thing to read,
    // not a reason to withhold the link.
    expect(wayAsVisitor(record())).toEqual({ offered: true, href: LIVE_URL });
  });

  it("a page ReachKit never made live has no way to offer and none to refuse", () => {
    expect(
      wayAsVisitor(
        record({
          state: "in_review",
          address: {
            offered: false,
            because: "never_made_live",
            copy: "record.address.neverMadeLive",
          },
          verification: { kind: "never", because: "no_live_address" },
        })
      )
    ).toBeNull();
  });

  it("every refusal carries a key, and no returned value carries a sentence", () => {
    for (const key of Object.values(REFUSAL_COPY)) {
      // Written since #460 (the owner's approved set of 2026-09-10).
      expect(COPY[key]).not.toBe(TODO_COPY_MARKER);
      expect(COPY[key]).not.toBe("");
      expect(AWAITING_COPY).not.toContain(key);
    }
    const refusal = wayAsVisitor(record({ verification: PAGE_NOT_FOUND }));
    expect(refusal).toMatchObject({ copy: expect.stringMatching(/^waythrough\./) as unknown as string });
  });

  it("REFUSAL_COPY is total over the three grounds and there is no fourth", () => {
    expect(Object.keys(REFUSAL_COPY).sort()).toEqual([
      "no_admin_address",
      "page_not_found",
      "unpublished_by_us",
    ]);
  });
});

describe("the module's own shape", () => {
  it("opening the day detail fetches neither address, now or ever", () => {
    // REQ-043's non-goal, in the requirement's own words. A `HEAD` request
    // added "just to check the link" fails here rather than at review.
    const code = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/app/(account)/app/calendar/ways.ts"),
      "utf8"
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/fetch\(|safeFetch|@\/lib\/egress|await /);
  });

  it("is pure and synchronous: the same record decides the same way twice", () => {
    expect(wayAsVisitor(record())).toEqual(wayAsVisitor(record()));
  });
});
