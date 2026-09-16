/** @vitest-environment jsdom */
// tests/app/setup/waiting.test.tsx — BUILD §4.3, REQ-029 criteria 1 and 2
//
// "While the deep pass runs: progress screen ... A degraded pass still
// releases setup." The two things this screen must be: the running step in
// written words, and nothing about time anywhere on it.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  redirect: vi.fn(),
}));

import { APP_PATH, destinationFor } from "@/app/(account)/setup/waiting/release";
import {
  DRAWN_ROWS,
  drawnStages,
  ROW_COPY_KEY,
  ROW_STAGES,
  rowOf,
} from "@/app/(account)/setup/_setup/stages";
import { ProgressStrip } from "@/app/(account)/setup/_setup/ProgressStrip";
import { COPY } from "@/lib/presentation/copy";
import { TIMING } from "@/lib/config/constants";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

describe('c1 — "they see which step is under way in written words rather than a bare spinner, [and] the step named is the step actually running"', () => {
  // Issue #782: the waiting screen is gone and the app's side panel names
  // the step (`tests/app/shell/onboarding.test.tsx` renders it). What stays
  // here is the mapping it names the step through.
  it("every handle the engine can report lands on a drawn row", () => {
    for (const row of DRAWN_ROWS) {
      for (const stage of ROW_STAGES[row]) expect(rowOf(stage), stage).toBe(row);
    }
  });

  it("the first draft, written before the release, is the fourth row", () => {
    expect(rowOf("writing_first_draft")).toBe("writing_your_first_page");
    const states = drawnStages({ stage: "writing_first_draft", enteredAt: {} }).map((row) => row.state);
    expect(states).toEqual(["done", "done", "done", "current", "pending"]);
  });

  it("a handle on the second drawn row makes the first one done", () => {
    const states = drawnStages({ stage: "checking_your_presence", enteredAt: {} }).map((row) => row.state);
    expect(states).toEqual(["done", "current", "pending", "pending", "pending"]);
  });

  it("a finished row's time is the difference between the pass's own instants — never a clock", () => {
    const drawn = drawnStages({
      stage: "scoring",
      enteredAt: {
        reading_your_site: "2026-09-05T09:31:00.000Z",
        checking_your_presence: "2026-09-05T09:31:41.000Z",
        scoring: "2026-09-05T09:31:59.000Z",
      },
    });
    expect(drawn.map((row) => row.seconds)).toEqual([41, 18, null, null, null]);
  });
});

describe('c2 — "when it ends, then the founder is taken into the app without any further action from them"', () => {
  it("a pass that ended releases into the app", () => {
    expect(destinationFor({ running: false, degraded: false })).toBe(APP_PATH);
  });

  it("a degraded pass releases identically — there is no arm that holds a founder", () => {
    expect(destinationFor({ running: false, degraded: true })).toBe(APP_PATH);
    expect(destinationFor({ running: false, degraded: true })).toBe(
      destinationFor({ running: false, degraded: false })
    );
  });

  it("a running pass is not released", () => {
    expect(destinationFor({ running: true, stage: "scoring", enteredAt: {} })).toBeNull();
  });
});

describe("the drawn rows span the engine's stages exactly, and the poll cadence is the pinned one", () => {
  it("the rows' handles concatenated are src/lib/scan/stages.ts's STAGES, in order", async () => {
    // Imported dynamically with the env fixture applied: `stages.ts`
    // reaches for `dbAdmin()` at module load, which parses `env`.
    //
    // This is what keeps the five-row drawing honest over a six-handle
    // engine: every handle is drawn on exactly one row, in the engine's
    // own order, so a stage added, removed or reordered upstream fails
    // here rather than landing silently on the wrong row.
    const { applyEnvFixture } = await import("../../mail/env-fixture.ts");
    applyEnvFixture();
    const { STAGES } = await import("@/lib/scan/stages");
    const drawn = DRAWN_ROWS.flatMap((row) => [...ROW_STAGES[row]]);
    expect(drawn).toEqual([...STAGES]);
  });

  it("the last two rows hold no handle, and that is the set's drawing", () => {
    // §8's writing and §9's checking are past the scan's six handles. The
    // first draft lights row four through its own stage (issue #782). The set draws both rows
    // blank; a row that can never be current is deliberate here.
    expect(ROW_STAGES.writing_your_first_page).toHaveLength(0);
    expect(ROW_STAGES.checking_it).toHaveLength(0);
  });

  it("every drawn row has its own written line, and no two share one", () => {
    const keys = DRAWN_ROWS.map((row) => ROW_COPY_KEY[row]);
    expect(new Set(keys).size).toBe(DRAWN_ROWS.length);
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(COPY, key)).toBe(true);
      expect(COPY[key]).not.toBe("TODO(copy)");
    }
  });

  it("the screen refreshes at the pinned heartbeat, so 'at least once every 30 seconds' is one number, not two", () => {
    expect(TIMING.progressHeartbeatS).toBe(30);
  });
});

describe("S11 — the strip, the card and the two approved lines (issue #356)", () => {
  it("the progress strip is the same three phases, one on: First page is current", () => {
    const strip = render(<ProgressStrip current="first-page" />);
    expect(strip.querySelector('[data-testid="setup-progress"]')?.getAttribute("data-current")).toBe(
      "first-page"
    );
    const steps = Array.from(strip.querySelectorAll("li")).map((li) => li.getAttribute("data-state"));
    // Paid and Setup are behind them; the first page is what is running.
    expect(steps).toEqual(["done", "done", "active"]);
  });

  it("the same component drives /setup, so the two screens cannot disagree about the phases", () => {
    const onSetup = Array.from(
      render(<ProgressStrip current="setup" />).querySelectorAll("li")
    ).map((li) => li.textContent);
    const onWaiting = Array.from(
      render(<ProgressStrip current="first-page" />).querySelectorAll("li")
    ).map((li) => li.textContent);
    expect(onWaiting).toEqual(onSetup);
    expect(onSetup).toEqual(["Paid", "Setup", "First page"]);
  });

  it("both of S11's lines are written, and the one that matters says what a fruitless pass does", () => {
    // Ruling 11a: the set's unbracketed strings are approved as written.
    // The first line is where the amended REQ-025 c1 spends its duration on
    // this screen; it carries the promise that outlives the clock.
    expect(COPY["setup.waiting.about"]).toContain("About three minutes");
    expect(COPY["setup.waiting.about"]).toContain("it never invents a page");
    expect(COPY["setup.waiting.close-tab"]).toBe(
      "You can close this tab; the sign-in link in your mail brings you back."
    );
  });

  it("no row's own name states a duration — the time is a separate slot", () => {
    // The five names are the set's five sentences and nothing more: a
    // duration belongs in `…stage.elapsed`, whose only content is a slot
    // and a unit, so a name can never carry a number nobody measured.
    for (const row of DRAWN_ROWS) {
      expect(COPY[ROW_COPY_KEY[row]], row).not.toMatch(
        /(\d+\s*(second|minute|hour)s?|~\s*\d|%|elapsed)/i
      );
    }
    expect(COPY["setup.waiting.stage.elapsed"]).toBe("{seconds} s");
  });
});
