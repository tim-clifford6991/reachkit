// BUILD §4.3 · UI-SPEC S11 — the five rows the set draws, over the engine's six.
//
// S11 draws five named stages: "Measuring your market" · "Sizing your
// rivals" · "Finding pages worth writing" · "Writing your first page" ·
// "Checking it". The engine reports six handles (`src/lib/scan/stages.ts`,
// pinned at six with a load-time throw), and they are not the same five:
// the engine's are the *scan's* dataset boundaries, and the set's last two
// name work that happens after the scan — §7's opportunities become §8's
// page, and then it is checked.
//
// So the rows are the set's and the handles map onto them. Three facts
// worth stating, because each is a decision a later reader could mistake
// for an accident:
//
//   1. **Rows one and two hold more than one handle each.** Reading the
//      site, reading its access rules and reading the market are all
//      "measuring your market" to the founder; the customer's own presence
//      and the twelve live SERPs are where rivals are seen, so both are
//      "sizing your rivals". This is the many-to-one the drawing asks for,
//      and it is why the screen shows five rows and not six.
//   2. **Rows four and five hold no handle, and light for no pass.** The
//      engine's six end at `scoring`; writing the page and checking it are
//      §8's and §9's, and the founder is released into the app as they
//      happen. The set draws both rows blank for the same reason — they
//      say what is coming, not what is running. A row that could never be
//      current would be a defect if the set did not draw it; it does.
//   3. **The order is the engine's, not this file's.** `ROW_STAGES` lists
//      handles in `STAGES`' own order and `stages.test.ts` asserts the
//      concatenation is exactly `STAGES`, so a handle added, removed or
//      reordered in the engine fails here rather than silently landing in
//      the wrong row.
import type { CopyKey } from "@/lib/presentation/copy";
import type { StageName } from "@/lib/scan/stages";

/** The five rows S11 draws, in its order. */
export const DRAWN_ROWS = [
  "measuring_your_market",
  "sizing_your_rivals",
  "finding_pages",
  "writing_your_first_page",
  "checking_it",
] as const;

export type DrawnRow = (typeof DRAWN_ROWS)[number];

/** One copy key per drawn row — the set's own five sentences (11a). */
export const ROW_COPY_KEY: Readonly<Record<DrawnRow, CopyKey>> = Object.freeze({
  measuring_your_market: "setup.waiting.stage.measuring-your-market",
  sizing_your_rivals: "setup.waiting.stage.sizing-your-rivals",
  finding_pages: "setup.waiting.stage.finding-pages",
  writing_your_first_page: "setup.waiting.stage.writing-your-first-page",
  checking_it: "setup.waiting.stage.checking-it",
});

/** Which engine handles each drawn row holds, in `STAGES`' order. The last
 *  two rows hold none: see this file's header, point 2. */
export const ROW_STAGES: Readonly<Record<DrawnRow, readonly StageName[]>> = Object.freeze({
  measuring_your_market: Object.freeze([
    "reading_your_site",
    "reading_access_rules",
    "reading_your_market",
  ] as const),
  sizing_your_rivals: Object.freeze(["checking_your_presence", "asking_the_twelve"] as const),
  finding_pages: Object.freeze(["scoring"] as const),
  writing_your_first_page: Object.freeze([] as const),
  checking_it: Object.freeze([] as const),
});

/** Which row a handle is drawn on. Derived from `ROW_STAGES`, so the two
 *  cannot disagree. */
export function rowOf(stage: StageName): DrawnRow | null {
  for (const row of DRAWN_ROWS) {
    if (ROW_STAGES[row].includes(stage)) return row;
  }
  return null;
}

/** One drawn row, resolved. `seconds` is whole seconds where the row has
 *  finished and the pass recorded both ends of it; `null` on the running
 *  row (the set draws a dash) and on a row that has not begun. */
export interface DrawnStage {
  readonly row: DrawnRow;
  readonly state: "done" | "current" | "pending";
  readonly seconds: number | null;
}

/**
 * The five rows, with each one's state and elapsed time.
 *
 * Pure: a pass in, five rows out. Every number it states is a difference
 * between two instants the pass recorded — never a clock read here, which
 * is what keeps the screen from drawing a duration nobody measured.
 *
 * A row that has finished is timed from its own first handle to the next
 * *drawn* row's first handle, so rows one and two are timed across the
 * several handles they hold rather than across one of them.
 */
export function drawnStages(a: {
  stage: StageName;
  enteredAt: Readonly<Partial<Record<StageName, string>>>;
}): readonly DrawnStage[] {
  const current = rowOf(a.stage);
  const at = (row: DrawnRow): number | null => {
    const first = ROW_STAGES[row][0];
    if (first === undefined) return null;
    const iso = a.enteredAt[first];
    if (iso === undefined) return null;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  };

  return DRAWN_ROWS.map((row, index): DrawnStage => {
    const currentIndex = current === null ? -1 : DRAWN_ROWS.indexOf(current);
    const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "pending";
    if (state !== "done") return { row, state, seconds: null };

    // Timed to the next drawn row that the pass actually entered — which
    // is the row after this one whenever the pass ran them in order, and
    // is the reason a row holding three handles states one duration.
    const began = at(row);
    const ended = DRAWN_ROWS.slice(index + 1).map(at).find((ms) => ms !== null) ?? null;
    if (began === null || ended === null || ended < began) return { row, state, seconds: null };
    return { row, state, seconds: Math.round((ended - began) / 1000) };
  });
}
