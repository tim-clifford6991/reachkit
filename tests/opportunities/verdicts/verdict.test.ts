// The too-early rule, and the order its two questions are asked in.
//
// Aging before evaluating reports a page that is demonstrably working as
// too early to judge — the opposite of REQ-063 c2's promise, and the more
// natural-looking spelling of "too early". The young-and-passing case is
// what fails when somebody writes it that way.
import { describe, expect, it } from "vitest";
import { TOO_EARLY_WEEKS } from "../../../src/lib/config/constants";
import { verdictFor, weeksSincePublished } from "../../../src/lib/opportunities/verdicts/verdict";

const WEEK = "2026-08-31";

function weeksBefore(n: number): Date {
  return new Date(Date.parse(`${WEEK}T00:00:00Z`) - n * 7 * 24 * 60 * 60 * 1000);
}

describe("REQ-063 c2 — evaluate first, age second", () => {
  it("a page published one week ago that already passes reads working", () => {
    expect(verdictFor({ passes: true, publishedAt: weeksBefore(1), week: WEEK })).toBe("working");
  });

  it("a page published one week ago that does not pass reads too_early, never not_working", () => {
    const verdict = verdictFor({ passes: false, publishedAt: weeksBefore(1), week: WEEK });
    expect(verdict).toBe("too_early");
    expect(verdict).not.toBe("not_working");
  });

  it("a page published four weeks ago that does not pass reads not_working", () => {
    expect(verdictFor({ passes: false, publishedAt: weeksBefore(4), week: WEEK })).toBe("not_working");
  });

  it("a page published on the day of the measurement, passing, reads working — age never withholds a pass", () => {
    expect(
      verdictFor({ passes: true, publishedAt: new Date(`${WEEK}T00:00:00Z`), week: WEEK })
    ).toBe("working");
  });
});

describe("the boundary is the pin, read from constants.ts and written nowhere else", () => {
  it("TOO_EARLY_WEEKS is three, and the boundary is at exactly three weeks", () => {
    expect(TOO_EARLY_WEEKS).toBe(3);
    // One tick under three weeks is still too early; exactly three is not.
    expect(
      verdictFor({ passes: false, publishedAt: new Date(weeksBefore(TOO_EARLY_WEEKS).getTime() + 1), week: WEEK })
    ).toBe("too_early");
    expect(
      verdictFor({ passes: false, publishedAt: weeksBefore(TOO_EARLY_WEEKS), week: WEEK })
    ).toBe("not_working");
  });

  it("age is measured to the week's own Monday, so re-reading a verdict later cannot age the page into a different answer", () => {
    expect(weeksSincePublished({ publishedAt: weeksBefore(2), week: WEEK })).toBe(2);
    // The same page, read against a later week, is older — which is a fact
    // about that week and not about this verdict.
    expect(weeksSincePublished({ publishedAt: weeksBefore(2), week: "2026-09-07" })).toBe(3);
  });

  it("a week start it cannot read is a refusal, never a guess", () => {
    expect(() => weeksSincePublished({ publishedAt: weeksBefore(1), week: "last monday" })).toThrow(
      /not a week start/
    );
  });
});
