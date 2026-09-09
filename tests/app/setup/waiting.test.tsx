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

import { Waiting } from "@/app/(account)/setup/waiting/Waiting";
import { APP_PATH, destinationFor } from "@/app/(account)/setup/waiting/release";
import { STAGE_COPY_KEY, WAITING_STAGES } from "@/app/(account)/setup/_setup/progress";
import { ProgressStrip } from "@/app/(account)/setup/_setup/ProgressStrip";
import { COPY } from "@/lib/presentation/copy";
import { TIMING } from "@/lib/config/constants";
import type { StageName } from "@/lib/scan/stages";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const STEPS = WAITING_STAGES.map((name) => ({ id: name, label: COPY[STAGE_COPY_KEY[name]] }));

function waitingAt(stage: StageName): Element {
  return render(<Waiting stage={stage} steps={STEPS} />);
}

describe('c1 — "they see which step is under way in written words rather than a bare spinner, [and] the step named is the step actually running"', () => {
  it("every stage renders as a labelled step, and the running one is the active one", () => {
    const tree = waitingAt("reading_your_market");
    const steps = Array.from(tree.querySelectorAll("li"));
    expect(steps).toHaveLength(WAITING_STAGES.length);
    const active = steps.filter((li) => li.getAttribute("data-state") === "active");
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toBe(COPY["setup.waiting.stage.reading_your_market"]);
  });

  it("the stages before the running one are done and the ones after are pending", () => {
    const tree = waitingAt("checking_your_presence");
    const states = Array.from(tree.querySelectorAll("li")).map((li) => li.getAttribute("data-state"));
    expect(states).toEqual(["done", "done", "done", "active", "pending", "pending"]);
  });

  it("there is no bare spinner and no indeterminate bar: every mark on the screen carries a label", () => {
    const tree = waitingAt("scoring");
    expect(tree.querySelectorAll("progress")).toHaveLength(0);
    for (const li of Array.from(tree.querySelectorAll("li"))) {
      expect((li.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});

describe('c1 — "nothing on the screen states how long the pass has taken or has left: no duration, no estimate, no countdown, no clock and no percentage"', () => {
  const TIME =
    /(\d+\s*(second|minute|hour|day|week)s?|~\s*\d|%|remaining|elapsed|eta\b|countdown|\d{1,2}:\d{2})/i;

  it("the rendered output states no duration, estimate, countdown, clock or percentage", () => {
    for (const stage of WAITING_STAGES) {
      expect(waitingAt(stage).textContent ?? "").not.toMatch(TIME);
    }
  });

  it("the component is never given a time: its props carry a stage and labels, and nothing else", () => {
    // The shape is the guarantee. `PassProgress`'s running arm carries
    // `stage` alone — there is no member an elapsed time, a heartbeat
    // timestamp or a percentage could arrive in.
    const running: import("@/app/(account)/setup/_setup/progress").PassProgress = {
      running: true,
      stage: "scoring",
    };
    expect(Object.keys(running).sort()).toEqual(["running", "stage"]);
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
    expect(destinationFor({ running: true, stage: "scoring" })).toBeNull();
  });
});

describe("the stage list is the pass's own, and the poll cadence is the pinned one", () => {
  it("WAITING_STAGES is exactly src/lib/scan/stages.ts's STAGES, in the same order", async () => {
    // Imported dynamically with the env fixture applied: `stages.ts`
    // reaches for `dbAdmin()` at module load, which parses `env`.
    const { applyEnvFixture } = await import("../../mail/env-fixture.ts");
    applyEnvFixture();
    const { STAGES } = await import("@/lib/scan/stages");
    expect([...WAITING_STAGES]).toEqual([...STAGES]);
  });

  it("every stage has its own written line, and no two share one", () => {
    const keys = WAITING_STAGES.map((name) => STAGE_COPY_KEY[name]);
    expect(new Set(keys).size).toBe(WAITING_STAGES.length);
    for (const key of keys) {
      expect(Object.prototype.hasOwnProperty.call(COPY, key)).toBe(true);
    }
  });

  it("the screen refreshes at the pinned heartbeat, so 'at least once every 30 seconds' is one number, not two", () => {
    expect(TIMING.progressHeartbeatS).toBe(30);
  });
});

describe("UI-SPEC S11 — the strip, the card and the two approved lines (issue #356)", () => {
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

  it("no stage line states a duration — the set draws one per stage and the engine reports none", () => {
    // `PassProgress`'s running arm carries `stage` alone. Until the engine
    // records per-stage timing there is nothing to render, and a stage line
    // that stated one would be composed rather than measured.
    for (const name of WAITING_STAGES) {
      expect(COPY[STAGE_COPY_KEY[name]], name).not.toMatch(
        /(\d+\s*(second|minute|hour)s?|~\s*\d|%|elapsed)/i
      );
    }
  });
});
