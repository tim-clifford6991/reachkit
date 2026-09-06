// tests/publish/publishable/predicate.test.ts — REQ-057 c2 to c7.
//
// The one expression of "a page becomes publishable when …" in the
// codebase. Each of criterion 2's four conjuncts is falsified alone and
// returns its own reason; copilot expiry is not an approval; a zero window
// is publishable at once.
//
// The archived plan is WO-215.
import { describe, expect, it } from "vitest";
import { becomesPublishable } from "@/lib/publish/publishable/predicate";
import { nextPublishTimeAtOrAfter } from "@/lib/publish/settings/clock";
import { TRANSITIONS } from "@/lib/publish/machine/table";
import type { DraftView, GoverningPair } from "@/lib/publish/types";

const HOUR = 3_600_000;
const ENTERED = new Date("2026-09-01T10:00:00Z");
const DEADLINE = new Date(ENTERED.getTime() + 24 * HOUR); // 2026-09-02T10:00Z

function pair(over: Partial<GoverningPair> = {}): GoverningPair {
  return { mode: "autopilot", vetoHours: 24, publishTime: "09:00", timezone: "UTC", ...over };
}

function view(over: Partial<DraftView> = {}): DraftView {
  return {
    id: "d1",
    siteId: "s1",
    state: "in_review",
    vetoDeadline: DEADLINE,
    approvedAt: null,
    approvedBy: null,
    hasUnsavedEdit: false,
    claimRecheckOutstanding: false,
    told: null,
    governing: pair(),
    ...over,
  };
}

describe('REQ-057 c2 — "it publishes under this rule and no other"', () => {
  it("each of the four conjuncts falsified alone returns its own reason", () => {
    // 1. the window has not started (autopilot, no deadline)
    expect(becomesPublishable(view({ vetoDeadline: null }))).toEqual({
      publishable: false,
      because: "window",
    });
    // 2. copilot without an explicit approval
    expect(becomesPublishable(view({ governing: pair({ mode: "copilot" }) }))).toEqual({
      publishable: false,
      because: "unapproved",
    });
    // 3. an unsaved edit
    expect(becomesPublishable(view({ hasUnsavedEdit: true }))).toEqual({
      publishable: false,
      because: "unsaved_edit",
    });
    // 4. an outstanding claim re-check
    expect(becomesPublishable(view({ claimRecheckOutstanding: true }))).toEqual({
      publishable: false,
      because: "claim_recheck",
    });
  });

  it("with all four satisfied it is publishable", () => {
    expect(becomesPublishable(view()).publishable).toBe(true);
  });

  it('"at the first publish time at or after it becomes publishable, and never before"', () => {
    const answer = becomesPublishable(view());
    expect(answer.publishable).toBe(true);
    if (!answer.publishable) return;
    // The window expires at 10:00 UTC; the publish time is 09:00 UTC, so the
    // first publish time at or after it is the next day's.
    expect(answer.at.getTime()).toBe(nextPublishTimeAtOrAfter(DEADLINE, {
      mode: "autopilot",
      vetoHours: 24,
      publishTime: "09:00",
      timezone: "UTC",
    }).getTime());
    expect(answer.at.getTime()).toBeGreaterThanOrEqual(DEADLINE.getTime());
  });

  it("it reads no clock of its own: the same draft gives the same answer whenever it is asked", () => {
    const first = becomesPublishable(view());
    const second = becomesPublishable(view());
    expect(first).toEqual(second);
  });

  it("an explicit approval is the moment it became publishable, under either mode", () => {
    const approvedAt = new Date("2026-09-05T08:00:00Z");
    for (const mode of ["autopilot", "copilot"] as const) {
      const answer = becomesPublishable(view({ approvedAt, governing: pair({ mode }) }));
      expect(answer.publishable, mode).toBe(true);
      if (!answer.publishable) continue;
      expect(answer.at.toISOString(), mode).toBe("2026-09-05T09:00:00.000Z");
    }
  });

  it("the unsaved_edit arm is present and returns its own reason — the arm is a guard, not a behaviour", () => {
    // No current caller can reach it: the draft view is loaded after the
    // editor has saved. This test is the only thing that fails when the
    // conjunct is deleted, which is exactly why it is here.
    expect(becomesPublishable(view({ hasUnsavedEdit: true })).publishable).toBe(false);
    expect(becomesPublishable(view({ hasUnsavedEdit: true }))).toHaveProperty(
      "because",
      "unsaved_edit"
    );
  });
});

describe('REQ-057 c3 — "under copilot, expiry does not make the page publishable — only an explicit approval does"', () => {
  it.each([-1, 0, 1])("at the boundary and %s ms either side, expiry is not an approval", (delta) => {
    const deadline = new Date(DEADLINE.getTime() + delta);
    expect(becomesPublishable(view({ vetoDeadline: deadline, governing: pair({ mode: "copilot" }) }))).toEqual(
      { publishable: false, because: "unapproved" }
    );
  });

  it("a copilot page stays approvable across later days and never becomes publishable of its own accord", () => {
    for (const days of [1, 7, 30]) {
      const deadline = new Date(DEADLINE.getTime() - days * 24 * HOUR);
      expect(
        becomesPublishable(view({ vetoDeadline: deadline, governing: pair({ mode: "copilot" }) })),
        `${days}d`
      ).toEqual({ publishable: false, because: "unapproved" });
    }
  });
});

describe('REQ-057 c4 — "expiry without a veto makes it publishable; a veto means it never publishes"', () => {
  it("under autopilot the deadline is the moment it becomes publishable", () => {
    const answer = becomesPublishable(view());
    expect(answer.publishable).toBe(true);
    if (!answer.publishable) return;
    expect(answer.at.getTime()).toBeGreaterThanOrEqual(DEADLINE.getTime());
  });

  it("a vetoed draft is never publishable — `skipped` is a state no edge leaves", () => {
    const leaving = TRANSITIONS.filter(([from]) => from === "skipped");
    expect(leaving).toEqual([]);
  });
});

describe('REQ-057 c5 — "the window that governs it is the one the customer\'s publishing settings hold at that moment"', () => {
  it("two evaluations of one draft under two pairs give two answers, and the predicate reads no settings itself", () => {
    const asAutopilot = becomesPublishable(view({ governing: pair({ mode: "autopilot" }) }));
    const asCopilot = becomesPublishable(view({ governing: pair({ mode: "copilot" }) }));
    expect(asAutopilot.publishable).toBe(true);
    expect(asCopilot.publishable).toBe(false);
  });

  it("moving the publish hour moves the moment the page goes out", () => {
    const nine = becomesPublishable(view({ governing: pair({ publishTime: "09:00" }) }));
    const noon = becomesPublishable(view({ governing: pair({ publishTime: "12:00" }) }));
    expect(nine.publishable && noon.publishable).toBe(true);
    if (!nine.publishable || !noon.publishable) return;
    expect(nine.at.getTime()).not.toBe(noon.at.getTime());
  });
});

describe('REQ-057 c7 — "at a veto window of zero it becomes publishable at once"', () => {
  it("the deadline is the moment the draft entered review, so `at` is the next publish time from then", () => {
    const answer = becomesPublishable(
      view({ vetoDeadline: ENTERED, governing: pair({ vetoHours: 0 }) })
    );
    expect(answer.publishable).toBe(true);
    if (!answer.publishable) return;
    // Entered 10:00 UTC; the next 09:00 UTC is the following morning.
    expect(answer.at.toISOString()).toBe("2026-09-02T09:00:00.000Z");
  });
});

describe("a site with no stated time zone is held, never published in a zone nobody chose", () => {
  it("answers `zone_not_set` rather than throwing or guessing", () => {
    expect(becomesPublishable(view({ governing: pair({ timezone: null }) }))).toEqual({
      publishable: false,
      because: "zone_not_set",
    });
  });

  it("it is not one of criterion 2's four conjuncts — the four still each have their own reason", () => {
    const reasons = new Set(
      [
        becomesPublishable(view({ vetoDeadline: null })),
        becomesPublishable(view({ governing: pair({ mode: "copilot" }) })),
        becomesPublishable(view({ hasUnsavedEdit: true })),
        becomesPublishable(view({ claimRecheckOutstanding: true })),
        becomesPublishable(view({ governing: pair({ timezone: null }) })),
      ].map((answer) => (answer.publishable ? "publishable" : answer.because))
    );
    expect(reasons.size).toBe(5);
  });
});
