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
import { withNuqs } from "./nuqs-adapter";

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
    <DayPanelView cell={cell} timeZone={FIXTURE_TIME_ZONE} stopped={MODEL.stopped}  onClose={() => undefined} />
  );
}

describe("REQ-043 c7, read as 'from md up' — an absent ?day is open on a desktop and closed on a phone", () => {
  // Owner, PR #961. "There is no month in which nothing is selected" is
  // unchanged from `md` up, where the panel stands beside the month. Below
  // it the panel is a sheet **over** the month, and the same default meant
  // a customer who tapped Plan landed on a sheet covering their plan.
  //
  // One DOM: the difference is `max-md:hidden` on the implicitly-open
  // panel, and which selection each shape of the month is handed.
  it("a day nobody asked for is drawn, marked hidden below md, and marks nothing in the list", () => {
    const root = render(withNuqs(<CalendarView model={MODEL} />));
    const panel = root.querySelector('[data-testid="day-panel"]');
    expect(panel).not.toBeNull();
    expect(panel?.className).toContain("max-md:hidden");
    expect(panel?.hasAttribute("data-implicit")).toBe(true);
    // The grid is drawn from `md` up, where this day *is* open.
    expect(
      root.querySelector(`[data-testid="calendar-cell-${MODEL.today}"]`)?.getAttribute("aria-current")
    ).toBe("date");
    // The list is drawn below it, where it is not — today is still marked
    // as today, and no row claims to be the open one.
    expect(
      root.querySelector(`[data-testid="calendar-day-${MODEL.today}"]`)?.hasAttribute("data-today")
    ).toBe(true);
    expect(
      root.querySelectorAll('[data-testid^="calendar-day-"][aria-current="date"]')
    ).toHaveLength(0);
  });

  it("a day the address names is open at every width, and the list marks it", () => {
    const root = render(withNuqs(<CalendarView model={MODEL} />, { day: "2026-09-18" }));
    const panel = root.querySelector('[data-testid="day-panel"]');
    expect(panel?.className).not.toContain("max-md:hidden");
    expect(panel?.hasAttribute("data-implicit")).toBe(false);
    expect(
      root.querySelector('[data-testid="calendar-day-2026-09-18"]')?.getAttribute("aria-current")
    ).toBe("date");
  });

  it("?day=none is closed at every width — the founder's own act, and it sticks", () => {
    const root = render(withNuqs(<CalendarView model={MODEL} />, { day: "none" }));
    expect(root.querySelector('[data-testid="day-panel"]')).toBeNull();
    expect(
      root.querySelectorAll('[data-testid^="calendar-cell-"][aria-current="date"]')
    ).toHaveLength(0);
  });
});

describe("REQ-043 c7 — today is the selected day when the calendar opens", () => {
  it("the panel the view renders on open is today's, not the month's first date", () => {
    const root = render(withNuqs(<CalendarView model={MODEL} />));
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
    const root = render(withNuqs(<CalendarView model={nz} />));
    expect(
      root.querySelector('[data-testid="calendar-cell-2026-09-16"]')?.getAttribute("aria-current")
    ).toBe("date");
  });

  it("a month that does not hold today still opens on a day — never on none", () => {
    const november = assembleMonth(FIXTURE_CALENDAR_FACTS, "2026-11");
    const root = render(withNuqs(<CalendarView model={november} />));
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
    const why = root.querySelector('[data-testid="target-rows"]');
    expect(why).not.toBeNull();
    // Issue 930: "Why this page" is what the block **is**, and it says so
    // to a reader rather than in a heading — the visible heads are its two
    // groups.
    expect(why?.getAttribute("aria-label")).toBe("calendar.why.title");
    const text = why?.textContent ?? "";
    for (const key of [
      "calendar.panel.search",
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

  it("issue 930 — the rows are in one order, and both screens draw this one list", () => {
    const why = root.querySelector('[data-testid="target-rows"]');
    const labels = [...(why?.querySelectorAll("dt") ?? [])].map((dt) => dt.textContent ?? "");
    expect(labels).toEqual([
      "calendar.why.search",
      "calendar.why.asked",
      "calendar.why.volume",
      "calendar.why.difficulty",
      "calendar.why.answered-today-by",
      "calendar.why.you",
      "calendar.why.band",
      "calendar.why.done-when",
    ]);
  });

  it("issue 930 — each engine is a row of its own, named with where it stood, and the difficulty is beside this site's ceiling", () => {
    const why = root.querySelector('[data-testid="target-rows"]');
    const text = why?.textContent ?? "";
    // The fixture's first specimen: difficulty 12 against a ceiling of 36,
    // and three engines. The line keys are the registry's, doubled to their
    // own names by this file's `copy` mock.
    expect(text).toContain("calendar.why.difficulty.of-ceiling");
    const engines = [...(why?.querySelectorAll('[data-testid^="engine-"]') ?? [])];
    expect(engines).toHaveLength(3);
    // The name and the standing are two elements, and the phrase that
    // joins them is still the registry's — on the row's own title.
    for (const engine of engines) {
      expect(engine.getAttribute("title")).toBe("calendar.why.engine.line");
    }
  });

  it("every value is mono, and the one criterion is not a value (§2.3; #297)", () => {
    const why = root.querySelector('[data-testid="target-rows"]');
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
    // Issue 930 splits the eight by **whether the value can grow**, which
    // is `docs/DESIGN.md`'s own rule and the layout sweep's:
    //
    //   three are bounded and mono, and never clamp — the demand, the
    //   difficulty and the place. A truncated *value* is an offender in
    //   the sweep whatever its class says, because a value cut in half is
    //   a different value; the box folds instead (`num-phrase`).
    //
    //   four can grow and clamp — the search, the question, the rival's
    //   domain and the acceptance test. Each is a declared truncation
    //   (`rk-cal-label`) whose whole string stays on the row's own title.
    //
    //   one is neither: the band, a word from a closed set.
    expect(why?.querySelectorAll("dd.num").length).toBe(3);
    expect(why?.querySelectorAll("dd.num-phrase").length).toBe(3);
    const clamped = [...(why?.querySelectorAll("dd.rk-cal-label") ?? [])];
    expect(clamped).toHaveLength(4);
    for (const value of clamped) {
      expect(value.getAttribute("title")).not.toBeNull();
      // A clamped row holds its text itself: an element inside a clipping
      // box escapes it the moment the text is long enough.
      expect(value.children.length).toBe(0);
      expect(value.className).not.toContain("num");
    }
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

  it("the stage word and the date head the panel", () => {
    const head = root.querySelector('[data-testid="day-head"]')?.textContent ?? "";
    expect(head).toContain("calendar.stage.your-review");
    expect(head).toContain("2026");
  });
});

describe("REQ-004 — an unmeasured value is a dash and a line, never a zero", () => {
  it("a page whose standing could not be measured renders the dash, not 0", () => {
    // The fixture's third specimen carries `unmeasured('undeterminable')`.
    const root = panel("2026-09-03");
    const values = [...(root.querySelectorAll('[data-testid="target-rows"] dd') ?? [])].map(
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

  it("a measured zero place is §6.6's cold start, said in words — never a `#0`, which is not a position", () => {
    // The trichotomy is unchanged and this is the *measured* arm: the
    // fixture's second specimen carries `measuredZero(0)` for where the
    // site stands, which is a measurement — the site holds no place — and
    // the panel states it (issue 930's "Not ranking"). What REQ-004
    // forbids is rendering an **unmeasured** value as a number, and the
    // row above is where that is asserted. A `0` here would read as a
    // rank of zero, which no search result has.
    const root = panel("2026-09-02");
    const values = [...(root.querySelectorAll('[data-testid="target-rows"] dd') ?? [])].map(
      (n) => n.textContent
    );
    // `copy` is mocked to the key in this file, so the assertion names the
    // key the words came from rather than the owner's wording.
    expect(values).toContain("calendar.why.not-ranking");
    expect(values).not.toContain("#0");
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
    const why = panel("2026-09-15").querySelector('[data-testid="target-rows"]');
    // The one measurement date in the fixture is 2026-09-14; it must not
    // appear five times beside five values.
    expect((why?.textContent ?? "").includes("Sep 14")).toBe(false);
  });
});

describe("REQ-043 c9 — the panel renders exactly the projection, and adds nothing", () => {
  it("a page in review offers Read the full page and Veto — and no Move", () => {
    const root = panel("2026-09-15");
    expect(root.querySelector('[data-testid="day-action-calendar.action.read-full-page"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).not.toBeNull();
    // Issue #913: Move always refused, so it is not drawn.
    expect(root.querySelector('[data-testid="day-action-calendar.action.move"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(2);
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

  it("a needs-you page offers the page, the restart and Skip — and no reconnect on a hosted site", () => {
    // Issue #130: `needs_attention → skipped` is one of §9's fifteen, so
    // the projection offers the stop.
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
    expect(root.querySelector('[data-testid="day-action-calendar.action.move"]')).toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.skip"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).toBeNull();
    expect(root.querySelectorAll('[data-testid^="day-action-"]')).toHaveLength(3);
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

  it("a planned page offers Skip, and never Veto or Move", () => {
    const root = panel("2026-09-18");
    expect(root.querySelector('[data-testid="day-action-calendar.action.skip"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.veto"]')).toBeNull();
    expect(root.querySelector('[data-testid="day-action-calendar.action.move"]')).toBeNull();
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
      // The one control an empty day does carry is the one SPEC §7 gave
      // every day in the 2026-09-20 redesign: the panel is closable. It
      // publishes nothing and approves nothing.
      const buttons = [...root.querySelectorAll("button")];
      expect(buttons.map((b) => b.getAttribute("data-testid")), day).toEqual(["day-panel-close"]);
    }
  });

  it("renders exactly one account, and no second one", () => {
    for (const [day] of empties) {
      const root = panel(day);
      expect(root.querySelectorAll('[data-testid="day-empty-line"]').length, day).toBeLessThanOrEqual(1);
      expect(root.querySelector('[data-testid="target-rows"]'), day).toBeNull();
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
      <DayPanelView cell={scheduled} timeZone={FIXTURE_TIME_ZONE} stopped={null}  onClose={() => undefined} />
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
  it("the head is the stage's dot and word at the near edge, the mono date beside them, and the close control at the far one", () => {
    // Issue 944, fixed here: the stage was a daisyUI `badge`, which carries
    // its own padding and does not shrink below its text. It is a dot and
    // a word now — on the card and in the panel, so one stage is drawn one
    // way (`stages.ts`).
    const head = panel("2026-09-15").querySelector('[data-testid="day-head"]');
    const children = [...(head?.children ?? [])];
    expect(children[0]?.className).toContain("rounded-full");
    expect(children[1]?.textContent).toBe("calendar.stage.your-review");
    expect(children[2]?.className).toContain("num");
    expect(children[3]?.getAttribute("data-testid")).toBe("day-panel-close");
    expect(head?.querySelector(".badge")).toBeNull();
  });

  it("review offers a solid way in across the column, with a warning-outline Veto under it", () => {
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
