/** @vitest-environment jsdom */
// tests/app/calendar/change-hold.test.tsx — BUILD §4.6, REQ-071 c11,
// DECISIONS 2026-09-06, issue #204
//
// The held day, driven from rows: a market answer under replacement holds
// generation, and the date says which change is holding pages and when they
// resume. Both values are `generationHold()`'s — the engine has already
// chosen one reason where two answers changed, so the screen never picks.
//
// The discriminating rows are the two neighbours in the precedence. A
// change-hold that outranked `customer_change_holds_pages` would take the
// customer's own switch off the date they can act on; one that ranked below
// `page_held` would tell a customer their page did not go out when no page
// was ever written. Both are asserted from facts, not from a fixture.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { applyEnvFixture } from "../../mail/env-fixture";

applyEnvFixture();

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return {
    ...actual,
    copy: (key: string, vars?: Record<string, string | number>) =>
      vars === undefined ? key : `${key}(${Object.values(vars).join("|")})`,
  };
});

const { accountFor, EMPTY_PRECEDENCE, EMPTY_COPY_KEY } = await import(
  "@/app/(account)/app/calendar/empty"
);
type EmptyFacts = import("@/app/(account)/app/calendar/empty").EmptyFacts;
type CalendarFacts = import("@/app/(account)/app/calendar/month").CalendarFacts;
type DayCell = import("@/app/(account)/app/calendar/month").DayCell;
const { assembleMonth, cellFor } = await import("@/app/(account)/app/calendar/month");
const { DayPanelView } = await import("@/app/(account)/app/calendar/DayPanelView");
const { CHANGE_COPY_KEY } = await import("@/app/(account)/app/calendar/change-line");
const { formatDate } = await import("@/app/(account)/app/_shell/format");

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const ZONE = "America/New_York";
const MONTH = "2026-09";
const NOW = new Date(Date.UTC(2026, 8, 15, 14, 0, 0));
const RESUMES = new Date(Date.UTC(2026, 8, 21, 10, 0, 0));

const NOTHING: EmptyFacts = {
  instruction: null,
  reachkitStopped: false,
  pageCannotGoLive: null,
  customerChangeHoldsPages: null,
  changeHoldsGeneration: null,
  pageHeld: false,
  unusedSupply: null,
};

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
    changeHoldsGeneration: null,
    unusedSupply: null,
    ...over,
  };
}

describe("REQ-071 c11 — a market answer under replacement holds the day", () => {
  it("the account names the held answer and the date pages resume, and nothing else", () => {
    expect(
      accountFor({
        ...NOTHING,
        changeHoldsGeneration: { because: "domain", resumesOn: RESUMES },
      })
    ).toEqual({ cause: "change_holds_generation", because: "domain", resumesOn: RESUMES });
  });

  it("a site replacing nothing takes no hold from this arm", () => {
    expect(accountFor({ ...NOTHING, unusedSupply: 0 }).cause).toBe("supply_exhausted");
  });
});

describe("its place in the seven-arm precedence, at both neighbours", () => {
  it("the customer's own saved switch outranks it — they can undo that one with a click", () => {
    const account = accountFor({
      ...NOTHING,
      customerChangeHoldsPages: "publishing_off",
      changeHoldsGeneration: { because: "category", resumesOn: RESUMES },
    });
    expect(account.cause).toBe("customer_change_holds_pages");
  });

  it("it outranks page_held — no page exists for the date at all", () => {
    // `page_held` says a page which does exist did not go out. Where
    // generation is held there was never a page to hold, and telling the
    // customer otherwise would be a false statement about their own queue.
    const account = accountFor({
      ...NOTHING,
      changeHoldsGeneration: { because: "domain", resumesOn: RESUMES },
      pageHeld: true,
    });
    expect(account.cause).toBe("change_holds_generation");
  });

  it("and it outranks the exhausted-supply arm, which REQ-043 c3 reserves", () => {
    const account = accountFor({
      ...NOTHING,
      changeHoldsGeneration: { because: "domain", resumesOn: RESUMES },
      unusedSupply: 0,
    });
    expect(account.cause).toBe("change_holds_generation");
    // Read off the order itself, so a re-sort fails here and not only in a
    // behavioural row.
    expect(EMPTY_PRECEDENCE.indexOf("change_holds_generation")).toBeGreaterThan(
      EMPTY_PRECEDENCE.indexOf("customer_change_holds_pages")
    );
    expect(EMPTY_PRECEDENCE.indexOf("change_holds_generation")).toBeLessThan(
      EMPTY_PRECEDENCE.indexOf("page_held")
    );
  });
});

describe("the day panel states it, with both slots filled from the engine", () => {
  it("names the change through its own key and the date through the site's zone", () => {
    const model = assembleMonth(
      facts({ changeHoldsGeneration: { because: "category", resumesOn: RESUMES } }),
      MONTH
    );
    const cell = cellFor(model, "2026-09-16") as DayCell;
    expect(cell.empty?.cause).toBe("change_holds_generation");

    const root = render(<DayPanelView cell={cell} timeZone={ZONE} stopped={null} />);
    const line = root.querySelector('[data-testid="day-empty-line"]')?.textContent ?? "";
    expect(line).toContain(EMPTY_COPY_KEY.change_holds_generation);
    // `{change}` is the owner's word, never the engine's handle.
    expect(line).toContain(CHANGE_COPY_KEY.category);
    expect(line).not.toMatch(/\|category\b/);
    // `{date}` is `resumesOn`, written in the customer's own zone by the
    // shell's one formatter — never a date this screen computed.
    expect(line).toContain(formatDate(RESUMES, ZONE));
  });

  it("every date of the month carries it, because a replacement holds the site and not a day", () => {
    const model = assembleMonth(
      facts({ changeHoldsGeneration: { because: "domain", resumesOn: RESUMES } }),
      MONTH
    );
    const held = model.cells.filter((c) => c.inMonth && c.empty?.cause === "change_holds_generation");
    expect(held.length).toBe(model.cells.filter((c) => c.inMonth).length);
  });
});
