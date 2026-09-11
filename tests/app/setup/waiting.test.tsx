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

import { Waiting, type WaitingRow } from "@/app/(account)/setup/waiting/Waiting";
import { APP_PATH, destinationFor } from "@/app/(account)/setup/waiting/release";
import {
  DRAWN_ROWS,
  drawnStages,
  ROW_COPY_KEY,
  ROW_STAGES,
} from "@/app/(account)/setup/_setup/stages";
import { ProgressStrip } from "@/app/(account)/setup/_setup/ProgressStrip";
import { COPY } from "@/lib/presentation/copy";
import { TIMING } from "@/lib/config/constants";
import type { StageName } from "@/lib/scan/stages";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

/** The rows the server would draw for a pass at `stage`, with every
 *  sentence resolved the way `waiting/page.tsx` resolves it. No elapsed
 *  times unless a caller supplies entries. */
function rowsAt(
  stage: StageName,
  enteredAt: Readonly<Partial<Record<StageName, string>>> = {}
): readonly WaitingRow[] {
  return drawnStages({ stage, enteredAt }).map((drawn) => ({
    id: drawn.row,
    label: COPY[ROW_COPY_KEY[drawn.row]],
    state: drawn.state,
    time:
      drawn.state === "current"
        ? COPY["setup.waiting.stage.running"]
        : drawn.seconds === null
          ? null
          : COPY["setup.waiting.stage.elapsed"].replace("{seconds}", String(drawn.seconds)),
  }));
}

function waitingAt(
  stage: StageName,
  enteredAt: Readonly<Partial<Record<StageName, string>>> = {}
): Element {
  return render(<Waiting rows={rowsAt(stage, enteredAt)} />);
}

describe('c1 — "they see which step is under way in written words rather than a bare spinner, [and] the step named is the step actually running"', () => {
  it("the five drawn rows render, each named, and one of them is current", () => {
    // UI-SPEC S11's five rows, not the engine's six handles: three of the
    // handles are drawn on the first row and two on the second.
    const tree = waitingAt("reading_your_market");
    const rows = Array.from(tree.querySelectorAll(".rk-stage"));
    expect(rows).toHaveLength(DRAWN_ROWS.length);
    expect(rows).toHaveLength(5);
    const current = rows.filter((row) => row.getAttribute("data-state") === "current");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain(COPY["setup.waiting.stage.measuring-your-market"]);
  });

  it("a handle on the second drawn row makes the first one done", () => {
    const tree = waitingAt("checking_your_presence");
    const states = Array.from(tree.querySelectorAll(".rk-stage")).map((row) =>
      row.getAttribute("data-state")
    );
    expect(states).toEqual(["done", "current", "pending", "pending", "pending"]);
  });

  it("every handle the engine can report lands on a drawn row, and marks it current", () => {
    // The mapping is total: no stage leaves the screen with no row lit,
    // which would be the bare spinner REQ-029 c1 forbids.
    for (const row of DRAWN_ROWS) {
      for (const stage of ROW_STAGES[row]) {
        const tree = waitingAt(stage);
        const current = Array.from(tree.querySelectorAll(".rk-stage")).find(
          (node) => node.getAttribute("data-state") === "current"
        );
        expect(current?.getAttribute("data-testid"), stage).toBe(`setup-stage-${row}`);
      }
    }
  });

  it("there is no bare spinner and no indeterminate bar: every mark carries a label", () => {
    const tree = waitingAt("scoring");
    expect(tree.querySelectorAll("progress")).toHaveLength(0);
    for (const row of Array.from(tree.querySelectorAll(".rk-stage"))) {
      expect((row.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});

describe("REQ-029 c1 as the approved set amends it — a finished row's time, and no clock", () => {
  // This block asserted that nothing on the screen stated a duration at
  // all, on the 2026-09-06 ruling. UI-SPEC S11 draws an elapsed time
  // beside every finished row, ruling 11a makes the drawing the
  // reference, and `sites.setup_stage_times` records the instants a
  // duration is computed from. So the rule is now: a **finished** row may
  // state one, the running row states a dash, and nothing anywhere
  // estimates, counts down or shows a percentage.
  const FORBIDDEN = /(~\s*\d|%|remaining|eta\b|countdown|\d{1,2}:\d{2})/i;

  /** A pass on the third drawn row, with the two before it timed — the
   *  state S11 draws. */
  const ENTERED = {
    reading_your_site: "2026-09-05T09:31:00.000Z",
    checking_your_presence: "2026-09-05T09:31:41.000Z",
    scoring: "2026-09-05T09:31:59.000Z",
  } as const;

  it("a finished row states its own elapsed time, from the pass's own instants", () => {
    const tree = waitingAt("scoring", ENTERED);
    const times = Array.from(tree.querySelectorAll(".rk-stage-t")).map((n) => n.textContent);
    // 41 s and 18 s are the differences between consecutive entries — the
    // very durations the set prints — and the running row's dash.
    expect(times).toEqual(["41 s", "18 s", COPY["setup.waiting.stage.running"]]);
  });

  it("the running row states a dash, never a running clock", () => {
    const tree = waitingAt("scoring", ENTERED);
    const current = Array.from(tree.querySelectorAll(".rk-stage")).find(
      (row) => row.getAttribute("data-state") === "current"
    );
    expect(current?.querySelector(".rk-stage-t")?.textContent).toBe(
      COPY["setup.waiting.stage.running"]
    );
  });

  it("a row the pass recorded no instant for states no time at all", () => {
    // Never a zero: a duration nobody measured is not a duration of none.
    const tree = waitingAt("scoring");
    expect(tree.querySelectorAll(".rk-stage-t")).toHaveLength(1);
  });

  it("a row that has not begun states nothing", () => {
    const tree = waitingAt("reading_your_site", ENTERED);
    const pending = Array.from(tree.querySelectorAll('.rk-stage[data-state="pending"]'));
    expect(pending.length).toBeGreaterThan(0);
    for (const row of pending) expect(row.querySelector(".rk-stage-t")).toBeNull();
  });

  it("nothing estimates, counts down, shows a clock or a percentage", () => {
    for (const row of DRAWN_ROWS) {
      for (const stage of ROW_STAGES[row]) {
        expect(waitingAt(stage, ENTERED).textContent ?? "", stage).not.toMatch(FORBIDDEN);
      }
    }
  });

  it("mutation check: the scan does catch what it forbids", () => {
    expect("~3 minutes").toMatch(FORBIDDEN);
    expect("40% done").toMatch(FORBIDDEN);
    expect("2:15 remaining").toMatch(FORBIDDEN);
    expect("41 s").not.toMatch(FORBIDDEN);
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

  it("a running pass renders the frame instead of redirecting", () => {
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
    // §8's writing and §9's checking are past the scan's six handles, and
    // the founder is released as they happen. The set draws both rows
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
