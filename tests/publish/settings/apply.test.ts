// tests/publish/settings/apply.test.ts — REQ-073 c4's four rules.
//
// Pure fixtures: no clock, no database. Every limb is falsifiable alone,
// which is the point of `newVetoDeadline` being a function of the whole
// situation rather than a pass over rows.
//
// The archived plan is WO-220.
import { describe, expect, it } from "vitest";
import { NOT_YET_PUBLISHED, isNotYetPublished, newVetoDeadline } from "@/lib/publish/settings/apply";
import type { PublishingSettings } from "@/lib/publish/settings/settings";
import { STATES } from "@/lib/publish/machine/table";
import type { State } from "@/lib/publish/types";

const HOUR = 3_600_000;

function settings(over: Partial<PublishingSettings> = {}): PublishingSettings {
  return { mode: "autopilot", vetoHours: 24, publishTime: "09:00", timezone: "UTC", ...over };
}

const ENTERED = new Date("2026-09-01T10:00:00Z");
const CHANGED = new Date("2026-09-02T12:00:00Z");

function deadline(a: {
  state?: State;
  currentDeadline: Date;
  previous?: PublishingSettings;
  next?: PublishingSettings;
  enteredReviewAt?: Date;
}): Date {
  return newVetoDeadline({
    state: a.state ?? "in_review",
    enteredReviewAt: a.enteredReviewAt ?? ENTERED,
    currentDeadline: a.currentDeadline,
    previous: a.previous ?? settings(),
    next: a.next ?? settings(),
    changedAt: CHANGED,
  });
}

describe('REQ-073 c4 rule 1 — "it applies to every draft not yet published, including drafts already in review"', () => {
  it("the in-scope set is §9's ten states minus the three a page comes to rest in", () => {
    const resting: State[] = ["published", "skipped", "unpublished"];
    expect([...NOT_YET_PUBLISHED].sort()).toEqual(
      STATES.filter((s) => !resting.includes(s)).slice().sort()
    );
  });

  it("a draft in review is in scope", () => {
    expect(isNotYetPublished("in_review")).toBe(true);
  });

  it.each(["published", "skipped", "unpublished"] as const)(
    "a %s draft is untouched — its deadline comes back exactly as it was",
    (state) => {
      const current = new Date("2026-09-02T10:00:00Z");
      expect(
        deadline({ state, currentDeadline: current, next: settings({ vetoHours: 168 }) }).getTime()
      ).toBe(current.getTime());
    }
  );
});

describe('REQ-073 c4 rule 2 — "a window already running is never shortened by it"', () => {
  it("shortening 7 days to 1 leaves a running window at its later expiry", () => {
    const current = new Date(ENTERED.getTime() + 168 * HOUR);
    const after = deadline({
      currentDeadline: current,
      previous: settings({ vetoHours: 168 }),
      next: settings({ vetoHours: 24 }),
    });
    expect(after.getTime()).toBe(current.getTime());
  });

  it("shortening to zero does not make a draft in review publishable at once", () => {
    const current = new Date(ENTERED.getTime() + 168 * HOUR);
    const after = deadline({
      currentDeadline: current,
      previous: settings({ vetoHours: 168 }),
      next: settings({ vetoHours: 0 }),
    });
    expect(after.getTime()).toBe(current.getTime());
    expect(after.getTime()).toBeGreaterThan(CHANGED.getTime());
  });
});

describe('REQ-073 c4 rule 3 — "a draft already in review whose window is lengthened keeps the later of the two expiry moments"', () => {
  it("1 day to 3 days moves the deadline out to entry + 3 days", () => {
    const current = new Date(ENTERED.getTime() + 24 * HOUR);
    const after = deadline({
      currentDeadline: current,
      previous: settings({ vetoHours: 24 }),
      next: settings({ vetoHours: 72 }),
    });
    expect(after.getTime()).toBe(ENTERED.getTime() + 72 * HOUR);
    expect(after.getTime()).toBeGreaterThan(current.getTime());
  });

  it("it is the later of the two, never simply the new one", () => {
    // A deadline already further out than entry + the new window stands.
    const current = new Date(ENTERED.getTime() + 200 * HOUR);
    const after = deadline({
      currentDeadline: current,
      previous: settings({ vetoHours: 24 }),
      next: settings({ vetoHours: 72 }),
    });
    expect(after.getTime()).toBe(current.getTime());
  });
});

describe('REQ-073 c4 rule 4 — "a draft whose window already expired under Copilot starts its window again at the moment of the change"', () => {
  it("a switch to Autopilot never makes a held draft publishable without the stated interval", () => {
    const expired = new Date(CHANGED.getTime() - HOUR);
    const after = deadline({
      state: "in_review",
      currentDeadline: expired,
      previous: settings({ mode: "copilot", vetoHours: 24 }),
      next: settings({ mode: "autopilot", vetoHours: 24 }),
    });
    expect(after.getTime()).toBe(CHANGED.getTime() + 24 * HOUR);
    expect(after.getTime()).toBeGreaterThan(CHANGED.getTime());
  });

  it("the restart is at the moment of the change, not at entry — an entry-based restart would still be expired", () => {
    const expired = new Date(CHANGED.getTime() - HOUR);
    const after = deadline({
      currentDeadline: expired,
      previous: settings({ mode: "copilot" }),
      next: settings({ mode: "autopilot" }),
    });
    expect(after.getTime()).not.toBe(ENTERED.getTime() + 24 * HOUR);
  });

  it("a Copilot draft whose window has NOT expired is not restarted — rule 3 governs it", () => {
    const running = new Date(CHANGED.getTime() + HOUR);
    const after = deadline({
      currentDeadline: running,
      previous: settings({ mode: "copilot", vetoHours: 24 }),
      next: settings({ mode: "autopilot", vetoHours: 24 }),
    });
    expect(after.getTime()).toBe(running.getTime());
  });

  it("rule 4 is scoped to in_review — an approved draft is untouched, because a settings change does not revoke an approval", () => {
    const expired = new Date(CHANGED.getTime() - HOUR);
    const after = deadline({
      state: "approved",
      currentDeadline: expired,
      previous: settings({ mode: "copilot" }),
      next: settings({ mode: "autopilot" }),
    });
    expect(after.getTime()).toBe(expired.getTime());
  });

  it("an Autopilot draft whose window expired is not restarted — the rule names Copilot", () => {
    const expired = new Date(CHANGED.getTime() - HOUR);
    const after = deadline({
      currentDeadline: expired,
      previous: settings({ mode: "autopilot" }),
      next: settings({ mode: "autopilot", vetoHours: 48 }),
    });
    expect(after.getTime()).toBe(ENTERED.getTime() + 48 * HOUR);
  });
});
