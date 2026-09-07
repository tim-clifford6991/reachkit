/** @vitest-environment jsdom */
// tests/app/calendar/law-lines.test.tsx — BUILD §4.6, REQ-092 c7, ADR-011,
// issue #113
//
// Two cross-cutting laws the calendar used to speak itself, now read from
// the module that owns each:
//
//   · every statement of when the next page publishes goes through
//     `nextPublishStatement()`, so while ReachKit has stopped its own work
//     the statement names the stop and gives **no other reason** — not the
//     date beside it, not the date as secondary text (ADR-011 point 5);
//   · a day emptied by ReachKit's own stop carries all three of
//     `stoppedWorkStatement()`'s lines, not the first of them.
//
// The discriminating case in the first pair is the one that looks
// redundant: a stopped day whose page **does** have a publish time. An
// implementation that fell back to the date whenever it had one passes
// every other row here and fails that one.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join(",")})`,
  };
});

import { COPY } from "@/lib/presentation/copy";
import { CAUSE_PRECEDENCE } from "@/lib/presentation/place";
import type { WorkStop } from "@/lib/presentation/stopped";
import { DayPanelView } from "@/app/(account)/app/calendar/DayPanelView";
import { CalendarView } from "@/app/(account)/app/calendar/CalendarView";
import {
  EMPTY_COPY_KEY,
  EMPTY_PRECEDENCE,
  LAW_CAUSES,
  isLawCause,
  stopForEmptyDay,
} from "@/app/(account)/app/calendar/empty";
import { assembleMonth, cellFor, type CalendarFacts, type DayCell } from "@/app/(account)/app/calendar/month";
import type { State } from "@/app/(account)/app/calendar/stages";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const ZONE = "America/New_York";
const MONTH = "2026-09";
const NOW = new Date(Date.UTC(2026, 8, 15, 14, 0, 0));
const AT = new Date(Date.UTC(2026, 8, 14, 6, 0, 0));

const STOP: WorkStop = {
  since: new Date(Date.UTC(2026, 8, 13, 0, 0, 0)),
  resumes: { on: new Date(Date.UTC(2026, 8, 20, 0, 0, 0)) },
  needs: { kind: "action", key: "stopped.work.needs-nothing" },
  partial: false,
};

function pageOn(day: string, state: State, publishAt: Date | null) {
  return {
    draftId: "d1",
    title: "a search",
    state,
    enteredReview: true,
    scheduledFor: day,
    why: {
      search: "a search",
      askedAs: "a question",
      answeredTodayBy: ["rival.example"],
      youStand: { kind: "unmeasured" as const, reason: "undeterminable" as const, at: AT },
      doneWhen: "",
      winnability: "winnable" as const,
    },
    measuredAt: AT,
    liveUrl: null,
    vetoDeadline: null,
    publishAt,
  };
}

function facts(over: Partial<CalendarFacts> = {}): CalendarFacts {
  return {
    timeZone: ZONE,
    now: NOW,
    stop: null,
    drafts: [],
    instructions: {},
    stoppedDays: [],
    heldDays: [],
    customerChangeHoldsPages: null,
    unusedSupply: null,
    ...over,
  };
}

describe("REQ-092 c7 — the day panel's publish line goes through the one function", () => {
  it("states the scheduled time where ReachKit has not stopped", () => {
    const at = new Date(Date.UTC(2026, 8, 16, 13, 0, 0));
    const model = assembleMonth(
      facts({ drafts: [pageOn("2026-09-16", "approved", at)] }),
      MONTH
    );
    const root = render(
      <DayPanelView
        cell={cellFor(model, "2026-09-16") as DayCell}
        timeZone={ZONE}
        stopped={null}
      />
    );
    expect(root.textContent).toContain("next-publish.scheduled");
    expect(root.textContent).not.toContain("next-publish.stopped");
  });

  it("names the stop and gives no other reason — the date is not shown beside it", () => {
    const at = new Date(Date.UTC(2026, 8, 16, 13, 0, 0));
    const model = assembleMonth(
      facts({ stop: STOP, drafts: [pageOn("2026-09-16", "approved", at)] }),
      MONTH
    );
    const root = render(
      <DayPanelView
        cell={cellFor(model, "2026-09-16") as DayCell}
        timeZone={ZONE}
        stopped={STOP}
      />
    );
    // The discriminating pair: the page *has* a publish time, and it is
    // still not stated. ADR-011 point 5 — "not 'prefers': ignores".
    const line = root.querySelector('[data-testid="day-publish-line"]')?.textContent;
    expect(line).toBe("next-publish.stopped");
    // Not the date beside it, not as secondary text, not in a slot: the
    // publish moment appears nowhere in the line.
    expect(line).not.toContain("next-publish.scheduled");
    expect(line).not.toContain("13:00");
  });

  it("a page with no publish moment makes no such statement, stopped or not", () => {
    const model = assembleMonth(
      facts({ stop: STOP, drafts: [pageOn("2026-09-16", "in_review", null)] }),
      MONTH
    );
    const root = render(
      <DayPanelView
        cell={cellFor(model, "2026-09-16") as DayCell}
        timeZone={ZONE}
        stopped={STOP}
      />
    );
    // Nothing to suppress, so nothing is said — never the stopped line as a
    // stand-in for a statement the panel was not making.
    expect(root.textContent).not.toContain("next-publish.");
  });
});

describe("REQ-092 c1, c2 and c4 — a stopped day carries all three lines", () => {
  it("the day panel states the stop, what is needed, and when work resumes", () => {
    const model = assembleMonth(facts({ stop: STOP, stoppedDays: ["2026-09-16"] }), MONTH);
    const cell = cellFor(model, "2026-09-16") as DayCell;
    expect(cell.empty?.cause).toBe("reachkit_stopped");

    const root = render(<DayPanelView cell={cell} timeZone={ZONE} stopped={STOP} />);
    expect(root.querySelector('[data-testid="day-empty-line"]')?.textContent).toBe(
      "stopped.work.line"
    );
    // c2: what is needed from the customer — the stop's own key, not a
    // sentence this screen composed.
    expect(root.querySelector('[data-testid="day-stopped-needs"]')?.textContent).toBe(
      "stopped.work.needs-nothing"
    );
    // c4: the date work is expected to resume, formatted in the site's zone.
    const resumes = root.querySelector('[data-testid="day-stopped-resumes"]')?.textContent;
    expect(resumes).toContain("stopped.work.resumes-on");
    expect(resumes).not.toBe("stopped.work.no-time-promised");
  });

  it("an unattributed day is the same stop said without a record, and still carries three lines", () => {
    // ADR-061 point 2. Nothing is known, so c2's arm is "nothing is needed"
    // and c4's is "no time is promised" — both true statements, and c4's
    // "never neither" is exactly what this arm satisfies.
    const model = assembleMonth(facts(), MONTH);
    const cell = cellFor(model, "2026-09-16") as DayCell;
    expect(cell.empty?.cause).toBe("unattributed");

    const root = render(<DayPanelView cell={cell} timeZone={ZONE} stopped={null} />);
    expect(root.querySelector('[data-testid="day-empty-line"]')?.textContent).toBe(
      "stopped.work.line"
    );
    expect(root.querySelector('[data-testid="day-stopped-needs"]')?.textContent).toBe(
      "stopped.work.needs-nothing"
    );
    expect(root.querySelector('[data-testid="day-stopped-resumes"]')?.textContent).toBe(
      "stopped.work.no-time-promised"
    );
  });

  it("a day the calendar accounts for itself carries its own one line and no stop lines", () => {
    const model = assembleMonth(facts({ unusedSupply: 0 }), MONTH);
    const cell = cellFor(model, "2026-09-16") as DayCell;
    expect(cell.empty?.cause).toBe("supply_exhausted");

    const root = render(<DayPanelView cell={cell} timeZone={ZONE} stopped={null} />);
    // Its own line, from its own key — and `writtenLine` renders nothing at
    // all while that key is owner-owed, which is REQ-091 c2's rule and not
    // this change's business.
    expect(root.textContent).not.toContain("stopped.work.line");
    expect(root.querySelector('[data-testid="day-stopped-needs"]')).toBeNull();
    expect(root.querySelector('[data-testid="day-stopped-resumes"]')).toBeNull();
    expect(COPY[EMPTY_COPY_KEY.supply_exhausted]).toBe("");
  });

  it("the grid cell states c1's line and no more — the panel is where c2 and c4 are read", () => {
    const model = assembleMonth(facts({ stop: STOP, stoppedDays: ["2026-09-16"] }), MONTH);
    const root = render(<CalendarView model={model} />);
    const text = root.textContent ?? "";
    expect(text).toContain("stopped.work.line");
    // One sentence per cell: the needs line appears once, in the panel
    // beside the grid, and not thirty times down the month.
    expect(text.split("stopped.work.needs-nothing").length - 1).toBeLessThanOrEqual(1);
  });
});

describe("stopForEmptyDay — two arms, and no invention in either", () => {
  it("carries the site's own stop where there is one", () => {
    expect(stopForEmptyDay({ cause: "reachkit_stopped", stop: STOP, since: NOW })).toBe(STOP);
  });

  it("answers a day with no record behind it with the two true statements", () => {
    for (const cause of ["reachkit_stopped", "unattributed"] as const) {
      const stop = stopForEmptyDay({ cause, stop: null, since: NOW });
      expect(stop.needs).toEqual({ kind: "nothing" });
      expect(stop.resumes).toEqual({ promised: false });
      // A partial pass is REQ-092 c6's page-produced-anyway, and every day
      // reaching here produced none.
      expect(stop.partial).toBe(false);
      expect(stop.since).toBe(NOW);
    }
  });
});

describe("ADR-011 point 6 — the two precedences are different unions that agree where they touch", () => {
  it("ReachKit's own stop is first in both orders", () => {
    // The calendar's own union orders the causes a *date* is empty for and
    // the place module's orders the causes a *place* is empty for; neither
    // union's members are statable of the other's subject. What ADR-061
    // point 4 requires of both is this one property, asserted rather than
    // remembered.
    expect(CAUSE_PRECEDENCE[0]).toBe("reachkit-stopped");
    // `instruction` outranks it on a date (REQ-043 c5), and the stop
    // outranks every cause below it — including, on the place side, the
    // customer's own instruction.
    expect(EMPTY_PRECEDENCE.indexOf("reachkit_stopped")).toBeLessThan(
      EMPTY_PRECEDENCE.indexOf("page_cannot_go_live")
    );
    expect(EMPTY_PRECEDENCE.indexOf("reachkit_stopped")).toBeLessThan(
      EMPTY_PRECEDENCE.indexOf("supply_exhausted")
    );
    expect(EMPTY_PRECEDENCE.indexOf("unattributed")).toBe(EMPTY_PRECEDENCE.length - 1);
  });

  it("the calendar names no line for either law cause, and its own five are its own", () => {
    for (const cause of LAW_CAUSES) {
      expect(isLawCause(cause)).toBe(true);
      expect(Object.keys(EMPTY_COPY_KEY)).not.toContain(cause);
    }
    expect(Object.values(EMPTY_COPY_KEY)).not.toContain("stopped.work.line");
    expect(Object.values(EMPTY_COPY_KEY)).not.toContain("next-publish.scheduled");
    // And the law's own lines are still written, so nothing this change
    // moved reads as a blank.
    expect(COPY["stopped.work.line"]).not.toBe("");
  });
});
