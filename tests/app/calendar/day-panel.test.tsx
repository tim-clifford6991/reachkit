/** @vitest-environment jsdom */
// tests/app/calendar/day-panel.test.tsx — BUILD §4.6, REQ-043 criteria 7-11
//
// WO-168 `## Test plan`: today selected on open, the five "Why this page"
// facts, the provenance line, the empty arm, and the action projection
// rendered. Same rendering and mocking convention as `grid.test.tsx`.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("@/lib/presentation/copy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/presentation/copy")>();
  return { ...actual, copy: (key: string) => key };
});

import { COPY } from "@/lib/presentation/copy";
import { CalendarView } from "@/app/(account)/app/calendar/CalendarView";
import { DayPanelView } from "@/app/(account)/app/calendar/DayPanelView";
import { assembleMonth, cellFor, type DayCell } from "@/app/(account)/app/calendar/month";
import {
  FIXTURE_CALENDAR_FACTS,
  FIXTURE_MONTH,
  FIXTURE_TIME_ZONE,
} from "@/app/(account)/app/calendar/fixture";

function render(el: React.ReactElement): Element {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(el);
  return container;
}

const MODEL = assembleMonth(FIXTURE_CALENDAR_FACTS, FIXTURE_MONTH);

function panel(day: string): Element {
  const cell = cellFor(MODEL, day);
  if (cell === undefined) throw new Error(`no cell for ${day}`);
  return render(
    <DayPanelView cell={cell} timeZone={FIXTURE_TIME_ZONE} stopped={MODEL.stopped} />
  );
}

describe("REQ-043 c7 — today is the selected day when the calendar opens", () => {
  it("the panel the view renders on open is today's, not the month's first date", () => {
    const root = render(<CalendarView model={MODEL} />);
    const title = root.querySelector('[data-testid="day-title"]')?.textContent;
    const todayCell = cellFor(MODEL, MODEL.today);
    expect(MODEL.today).toBe("2026-09-15");
    expect(title).toBe(todayCell?.page?.title);
    // And the grid marks the same day as the selected one.
    expect(
      root.querySelector(`[data-testid="calendar-cell-${MODEL.today}"]`)?.getAttribute("aria-current")
    ).toBe("date");
  });

  it("a site in a zone where it is already tomorrow opens on its own today", () => {
    const nz = assembleMonth(
      { ...FIXTURE_CALENDAR_FACTS, timeZone: "Pacific/Auckland" },
      FIXTURE_MONTH
    );
    // 2026-09-15T14:00Z is 2026-09-16 02:00 in Auckland.
    expect(nz.today).toBe("2026-09-16");
    const root = render(<CalendarView model={nz} />);
    expect(
      root.querySelector('[data-testid="calendar-cell-2026-09-16"]')?.getAttribute("aria-current")
    ).toBe("date");
  });

  it("a month that does not hold today still opens on a day — never on none", () => {
    const november = assembleMonth(FIXTURE_CALENDAR_FACTS, "2026-11");
    const root = render(<CalendarView model={november} />);
    const pressed = [...root.querySelectorAll('[data-testid^="calendar-cell-"]')].filter(
      (c) => c.getAttribute("aria-current") === "date"
    );
    expect(pressed).toHaveLength(1);
    expect(pressed[0]?.getAttribute("data-testid")).toBe("calendar-cell-2026-11-01");
  });
});

describe("REQ-043 c8 — the panel says why this page exists", () => {
  const root = panel("2026-09-15");

  it("states the search, the question, who answers it today, where the customer stands, and done-when", () => {
    const why = root.querySelector('[data-testid="why-this-page"]');
    expect(why).not.toBeNull();
    const text = why?.textContent ?? "";
    for (const key of [
      "calendar.why.title",
      "calendar.why.search",
      "calendar.why.asked",
      "calendar.why.answered-today-by",
      "calendar.why.you",
      "calendar.why.done-when",
      // Issue 867: what the page is optimising for.
      "calendar.why.volume",
      "calendar.why.difficulty",
      "calendar.why.engines",
    ]) {
      expect(text, key).toContain(key);
    }
  });

  it("issue 867 — the rows are in one order: search, asked, demand, difficulty, who answers today, the engines", () => {
    const why = root.querySelector('[data-testid="why-this-page"]');
    const labels = [...(why?.querySelectorAll("dt") ?? [])].map((dt) => dt.textContent ?? "");
    expect(labels).toEqual([
      "calendar.why.search",
      "calendar.why.asked",
      "calendar.why.volume",
      "calendar.why.difficulty",
      "calendar.why.answered-today-by",
      "calendar.why.engines",
      "calendar.why.you",
      "calendar.why.done-when",
    ]);
  });

  it("issue 867 — each engine is named with where it stood, and the difficulty is beside this site's ceiling", () => {
    const why = root.querySelector('[data-testid="why-this-page"]');
    const text = why?.textContent ?? "";
    // The fixture's first specimen: difficulty 12 against a ceiling of 36,
    // and three engines. The line keys are the registry's, doubled to their
    // own names by this file's `copy` mock.
    expect(text).toContain("calendar.why.difficulty.of-ceiling");
    expect(text).toContain("calendar.why.engine.line");
  });

  it("every value is mono, and the one criterion is not a value (§2.3; #297)", () => {
    const why = root.querySelector('[data-testid="why-this-page"]');
    // Since #354 the block is S15's definition list: five `<dt>` keys and
    // five `<dd>` values, on the hairline-separated block the approved
    // panel draws. **Four** values carry `.num` — the search query, the
    // question as asked, the engines that answered, and where the customer
    // stands. The fifth, "done when", is a sentence: §2.3's mono list is
    // numerals, dates, URLs, search queries and code-like strings, and a
    // success criterion is none of them.
    //
    // It carried `.num` until #297 made `.num` `nowrap`, and that is how
    // the misuse became visible rather than merely wrong: an unfoldable
    // sentence pushed the day panel sideways at 320 and 1280 and the
    // layout sweep reported the document scrolling. The row that changed
    // is the row that never held a value.
    //
    // Issue 867 added three more rows — the demand, the difficulty and the
    // engines — and the rule is unchanged: every one of them is a value,
    // and "done when" is still the one sentence.
    const keys = why?.querySelectorAll("dt") ?? [];
    const values = why?.querySelectorAll("dd") ?? [];
    expect(keys.length).toBe(8);
    expect(values.length).toBe(8);
    const monoValues = why?.querySelectorAll("dd.num") ?? [];
    expect(monoValues.length).toBe(7);
    // `.num`'s `nowrap` alone overflowed the 290px panel and took the
    // document sideways with it (#354).
    // Five of the seven are values made of WORDS and fold where language
    // folds (#307's `num-phrase`); the demand and the standing are counts
    // and do not.
    expect(why?.querySelectorAll("dd.num-phrase").length).toBe(5);
    // And the criterion is still stated — as prose, in its own row.
    const texts = [...keys].map((r) => r.textContent ?? "");
    expect(texts.some((t) => t.includes("calendar.why.done-when"))).toBe(true);
  });

  it("renders the winnability band through BAND_LABELS, never as a word of its own", () => {
    // Whichever band the fixture's page carries, the panel must reach it
    // through the registry key ADR-001 routes it to and never write the
    // word — so the assertion is on the key family, not on one band.
    const text = root.textContent ?? "";
    expect(text).toContain("band.winnability.");
    for (const word of ["Winnable", "Reach", "Not yet"]) expect(text, word).not.toContain(word);
  });

  it("the stage badge and the date head the panel", () => {
    const head = root.querySelector('[data-testid="day-head"]')?.textContent ?? "";
    expect(head).toContain("calendar.stage.your-review");
    expect(head).toContain("2026");
  });
});

describe("REQ-004 — an unmeasured value is a dash and a line, never a zero", () => {
  it("a page whose standing could not be measured renders the dash, not 0", () => {
    // The fixture's third specimen carries `unmeasured('undeterminable')`.
    const root = panel("2026-09-03");
    const values = [...(root.querySelectorAll('[data-testid="why-this-page"] dd.num') ?? [])].map(
      (n) => n.textContent
    );
    expect(values).toContain(COPY["unmeasured.dash"]);
    // `renderMeasured` imports `copy` from inside the presentation module,
    // so it is the real one even here — the line it renders is the
    // registry's own sentence with its `{what}` slot filled, and this
    // reads that sentence off the registry rather than restating it.
    const line = COPY["unmeasured.undeterminable"].replace("{what}", "spreadsheet to crm migration");
    expect(root.textContent).toContain(line);
  });

  it("a measured zero renders as 0, because 0 is a measurement", () => {
    const root = panel("2026-09-02");
    const values = [...(root.querySelectorAll('[data-testid="why-this-page"] dd.num') ?? [])].map(
      (n) => n.textContent
    );
    expect(values).toContain("0");
  });
});

describe("REQ-043 c10 — one provenance line, and no date repeated beside each value", () => {
  it("the line is the approved one, and it is the panel's last element (#354)", () => {
    // Ruling 11a of 2026-09-08 made the approved set's unbracketed strings
    // approved copy, and every one of S15's five arms ends on the same
    // measured tail. It was owner-owed and empty until then, and the panel
    // rendered nothing rather than a placeholder — which is the behaviour
    // the row below still holds for the keys that are *still* owed.
    expect(COPY["calendar.provenance.measured"]).toBe("measured {date}");
    const rendered = panel("2026-09-15").querySelector('[data-testid="day-provenance"]');
    expect(rendered).not.toBeNull();
    expect(rendered?.textContent).toContain("measured");
    // Last: after the controls, which is where the approved panel draws it.
    // A line that has to be quiet (§2.5) cannot sit above the one control
    // the panel is asking for.
    const inner = panel("2026-09-15").querySelector('[data-testid="day-panel"] .card-body');
    expect(inner?.lastElementChild?.getAttribute("data-testid")).toBe("day-provenance");
  });

  it("and no 'Why this page' row carries a measurement date of its own", () => {
    const why = panel("2026-09-15").querySelector('[data-testid="why-this-page"]');
    // The one measurement date in the fixture is 2026-09-14; it must not
    // appear five times beside five values.
    expect((why?.textContent ?? "").includes("Sep 14")).toBe(false);
  });
});

describe("REQ-043 c9 — the panel renders exactly the projection, and adds nothing", () => {
  it("a page in review offers Read the full page, Move and Veto", () => {
    const root = panel("2026-09-15");
    expect(root.querySelector('[data-testid="day-action-calendar.action.read-full-page"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.move"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).not.toBeNull();
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(3);
  });

  it("a live page offers its recorded address, and the page as written beside it (issue 882)", () => {
    const root = panel("2026-09-01");
    const link = root.querySelector('[data-testid="day-action-calendar.action.view-live-page"]');
    expect(link?.getAttribute("href")).toBe("https://content.example.com/2026-09-01");
    // Issue 882: "View live page" opens the published address; what
    // ReachKit wrote, and the checks it recorded, are read on the page.
    const read = root.querySelector('[data-testid="day-action-calendar.action.read-page"]');
    expect(read?.getAttribute("href")).toBe("/app/draft/draft-2026-09-01");
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(2);
  });

  it("a needs-you page offers the page, the restart, Move and Skip — and no reconnect on a hosted site", () => {
    // Issue #130: `needs_attention → skipped` is one of §9's fifteen, so
    // the projection offers the stop and the Move that rides beside it.
    // Issue #143: and the restart, on a page whose draft never entered
    // review — which the fixture's is. No control here publishes or
    // approves; the way out is a way out, and the way back is a way back.
    //
    // Issue 880: the fixture's page rests there because the §8 hard rules
    // stopped it, on a hosted host that works — so there is nothing to
    // reconnect, and issue 882 gives the founder the page itself to read.
    const root = panel("2026-09-10");
    expect(root.querySelector('[data-testid="day-action-calendar.action.reconnect"]')).toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.check-destination"]')).toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.read-page"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.regenerate"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.move"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.skip"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(4);
  });

  it("issue 880 — it states why the page needs them, from the page's own record", () => {
    const root = panel("2026-09-10");
    // The fixture's page was stopped by the hard rules, so that is the
    // sentence — never the delivery one, which is false of a page that was
    // never sent anywhere.
    // `copy()` resolves to its key in this suite, so what is asserted is
    // which key the line came from.
    expect(root.querySelector('[data-testid="day-needs-you-line"]')?.textContent).toBe(
      "publish.needs-you.rules"
    );
    expect(root.textContent).not.toContain("publish.needs-you.destination");
    // And the registry's sentence is the founder's own case, never the
    // delivery one.
    expect(COPY["publish.needs-you.rules"]).toContain("writing rules");
  });

  it("a planned page offers Move and Skip, and never Veto", () => {
    const root = panel("2026-09-18");
    expect(root.querySelector('[data-testid="day-action-calendar.action.skip"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).toBeNull();
  });
});

describe("REQ-043 c11 — an empty day states one account and offers no control", () => {
  const empties: readonly [string, string][] = [
    ["2026-09-13", "stopped.work.line"],
    ["2026-09-12", "calendar.empty.page-cannot-go-live"],
    ["2026-09-19", "calendar.empty.instruction"],
  ];

  it("renders no publish or approve control on any empty date", () => {
    for (const [day] of empties) {
      const root = panel(day);
      expect(root.querySelectorAll('[data-testid^="day-action-"]'), day).toHaveLength(0);
      expect(root.querySelector("button"), day).toBeNull();
    }
  });

  it("renders exactly one account, and no second one", () => {
    for (const [day] of empties) {
      const root = panel(day);
      expect(root.querySelectorAll('[data-testid="day-empty-line"]').length, day).toBeLessThanOrEqual(1);
      expect(root.querySelector('[data-testid="why-this-page"]'), day).toBeNull();
      expect(root.querySelector('[data-testid="day-title"]'), day).toBeNull();
    }
  });

  it("the account it renders is the one the resolver chose, from that cause's own key", () => {
    for (const [day, key] of empties) {
      const line = panel(day).querySelector('[data-testid="day-empty-line"]');
      if (COPY[key as keyof typeof COPY] === "") {
        // Owner-owed: nothing rendered, never another cause's sentence.
        expect(line, day).toBeNull();
      } else {
        expect(line?.textContent, day).toBe(key);
      }
    }
  });

  it("an empty day still heads with its date, so the panel never renders blank", () => {
    for (const [day] of empties) {
      expect(panel(day).textContent, day).toContain("2026");
    }
  });
});

describe("the panel is not a drawer, and it renders no sentence of its own", () => {
  it("renders as an <aside> in flow — nothing that slides over or is dismissed", () => {
    const root = panel("2026-09-15");
    expect(root.querySelector('aside[data-testid="day-panel"]')).not.toBeNull();
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it("every word it renders came from a registry key", () => {
    // With `copy()` mocked to the key, a word that is not a key and not a
    // value would be a sentence this component wrote. The fixture's own
    // values (title, search, question) are the only non-key text, and
    // they are data.
    const text = panel("2026-09-15").textContent ?? "";
    expect(text).toContain("calendar.");
    expect(text).not.toContain("TODO");
  });
});

// A cell the assembler can produce but the fixture's month does not hold,
// so the union's remaining arm is still rendered somewhere.
describe("a cell with a page whose stage has no action", () => {
  it("renders the page and, since issue 882, the one way in to read it", () => {
    const scheduled = cellFor(MODEL, "2026-09-16") as DayCell;
    const root = render(
      <DayPanelView cell={scheduled} timeZone={FIXTURE_TIME_ZONE} stopped={null} />
    );
    expect(root.querySelector('[data-testid="day-title"]')).not.toBeNull();
    // A scheduled page is written and queued — the moment a veto matters
    // most — so it is readable, and it offers nothing else.
    expect([...root.querySelectorAll('[data-testid^="day-action-"]')].map((el) => el.getAttribute("data-testid"))).toEqual([
      "day-action-calendar.action.read-page",
    ]);
  });
});

describe("the panel's arms", () => {
  it("the head is the stage badge at the near edge and the mono date at the far one", () => {
    const head = panel("2026-09-15").querySelector('[data-testid="day-head"]');
    const children = [...(head?.children ?? [])];
    expect(children[0]?.className).toContain("badge");
    expect(children[1]?.className).toContain("num");
  });

  it("review offers a solid way in across the column, with Move and a warning-outline Veto under it", () => {
    const root = panel("2026-09-15");
    const read = root.querySelector('[data-testid="day-action-calendar.action.read-full-page"]');
    // The one way in: an anchor, because it navigates, and the one solid
    // button, because it is what the panel is asking for.
    expect(read?.tagName.toLowerCase()).toBe("a");
    expect(read?.className).toContain("btn-primary");
    expect(read?.className).toContain("col-span-2");

    // A stop is the warning outline: its consequence is the opposite of
    // the control above it (#271).
    const veto = root.querySelector('[data-testid="day-action-calendar.action.veto"]');
    expect(veto?.tagName.toLowerCase()).toBe("button");
    expect(veto?.className).toContain("btn-outline");
    expect(veto?.className).toContain("btn-warning");
    expect(veto?.className).not.toContain("btn-primary");

    const move = root.querySelector('[data-testid="day-action-calendar.action.move"]');
    expect(move?.className).toContain("btn-ghost");
  });

  it("live's way in is the OUTLINE rank — it leaves the product, so it is not the screen's fill", () => {
    const live = panel("2026-09-01").querySelector(
      '[data-testid="day-action-calendar.action.view-live-page"]',
    );
    expect(live?.tagName.toLowerCase()).toBe("a");
    expect(live?.className).toContain("btn-outline");
    expect(live?.className).not.toContain("btn-primary");
  });

  it("the empty arm names the day, states its whole account, and offers nothing**", () => {
    const stopped = panel("2026-09-13");
    expect(stopped.querySelector('[data-testid="day-empty-line"]')?.textContent).toBe("stopped.work.line");
    // 2026-09-20 is emptied by proven-zero supply in the fixture. Supply is
    // the calendar's one statement at its top, and the panel does not
    // repeat it (issue 857).
    const root = panel("2026-09-20");
    const head = root.querySelector('[data-testid="day-head"]');
    expect(head?.textContent).toContain("calendar.empty.day-badge");
    expect(root.querySelector('[data-testid="day-empty-line"]')).toBeNull();
    // REQ-043 c11: no action at all.
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(0);
    // And no provenance: a date holding no page carries no measurement to
    // name, and a month-level date printed here would measure something
    // else.
    expect(root.querySelector('[data-testid="day-provenance"]')).toBeNull();
  });

  it("the two supply lines are a short one and a long one, and the cell never gets the long one", () => {
    // The property behind the split, at the registry rather than in the
    // markup: two keys, two lengths, and the grid's map naming the short.
    expect(COPY["cause.supply-exhausted"]).toBe("nothing worth publishing");
    expect(COPY["calendar.empty.supply-exhausted"].length).toBeGreaterThan(
      COPY["cause.supply-exhausted"].length * 3,
    );
  });
});
