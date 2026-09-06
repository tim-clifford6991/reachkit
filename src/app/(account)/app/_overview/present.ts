// BUILD §4.5 — how this screen puts a number and a sentence on the page.
//
// Two rules, one file, so neither can be half-applied:
//
//   1. **Every value goes through `renderMeasured`.** REQ-004's trichotomy
//      is the product's promise that an unmeasured input never appears as a
//      zero and a measured zero never appears as a dash. `renderMeasured`
//      is the only path from a `Measured<T>` to a string, and this module is
//      the only place on Overview that calls it — so no module can render a
//      number a different way.
//   2. **Every sentence comes from the registry, and an unwritten one
//      renders as nothing.** `writtenLine` is the shell's own reader
//      (`../_shell/written.ts`) and Overview shares it rather than
//      declaring a second: two readers would be two answers to "what does
//      the screen do with a key the owner has not written yet", and the
//      answer has to be one.
//
// Numerals are formatted with the site's locale-free grouping — every
// numeral on this screen renders inside `.num` (`src/ui/type.css`), which is
// the one mechanism §2.3's mono rule is enforced through.
import type { Measured, UnmeasuredReason } from "@/lib/measure/measured";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { renderMeasured } from "@/lib/presentation/measured";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import type { HeadlineNumber } from "./model";

/** The two lines REQ-004 c6 and c9 name, keyed by the reason. */
const UNMEASURED_LINE: Readonly<Record<UnmeasuredReason, CopyKey>> = Object.freeze({
  undeterminable: "unmeasured.undeterminable",
  not_attempted: "unmeasured.not-attempted",
});

/** The same locale the shell states its dates in (`../_shell/format.ts`
 *  fixes it once for the MVP's US-English). Grouping only — no currency, no
 *  unit, no rounding. */
const NUMBER_LOCALE = "en-US";

export function formatCount(value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE).format(value);
}

/** A day of the month, in the given zone — the shortest label that still
 *  names which day a chart mark is.
 *
 *  **Chart labels are sized to the viewBox, not to the sentence.** §2.4
 *  fixes charts as "hand-sized viewBoxes" and requires every mark to be
 *  direct-labelled; a label wider than the room the drawing leaves it is
 *  drawn outside the viewBox and clipped by the `<svg>`'s own overflow,
 *  which the layout sweep reports as a containment offender and a reader
 *  sees as a half-printed date. So this screen hands its charts the
 *  shortest label that is still unambiguous in its own context: a
 *  day-of-month inside one named week or one twelve-week window, and
 *  `formatMonthDay` where a series spans months. The full date is still
 *  reachable — it is what the mark's own tooltip carries. */
export function formatDayOfMonth(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALE, { timeZone, day: "numeric" }).format(at);
}

/** A month and a day, in the given zone — a growth point's own week, in the
 *  room a weekly column leaves it. The year is the shell's to state, and it
 *  does (`Week n · measured 31 Aug 2026`). */
export function formatMonthDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(NUMBER_LOCALE, { timeZone, month: "short", day: "numeric" }).format(
    at
  );
}

export interface RenderedValue {
  text: string;
  isDash: boolean;
  /** The written line naming why, where there is one and the owner has
   *  written it. */
  line?: string;
}

/** A measured number, rendered. `subjectKey` names what could not be
 *  measured — the `{what}` slot the two unmeasured lines take — and is
 *  always the module's own name, never a sentence composed here. */
export function renderValue(m: Measured<number>, subjectKey: CopyKey): RenderedValue {
  const reason = m.kind === "unmeasured" ? m.reason : "undeterminable";
  const rendered = renderMeasured(m, {
    format: formatCount,
    unmeasuredLine: UNMEASURED_LINE[reason],
    what: copy(subjectKey),
  });
  return rendered.line === undefined
    ? { text: rendered.text, isDash: rendered.isDash }
    : { text: rendered.text, isDash: rendered.isDash, line: rendered.line };
}

/** §4.5's data rule, resolved: "every value carries its delta or its goal,
 *  never bare." The delta where a previous measurement exists and produced
 *  one; otherwise the goal, which always exists. */
export type Carried =
  | { kind: "delta"; markKey: CopyKey; text: string }
  | { kind: "goal"; text: string; means: string | null };

export function carriedBy(headline: HeadlineNumber<number>, subjectKey: CopyKey): Carried {
  const delta = headline.delta;
  if (delta !== undefined && delta.kind !== "unmeasured") {
    return {
      kind: "delta",
      markKey: delta.value < 0 ? "overview.delta.down" : "overview.delta.up",
      text: renderValue({ ...delta, value: Math.abs(delta.value) }, subjectKey).text,
    };
  }
  const goal = GOALS[headline.goal];
  return {
    kind: "goal",
    text: copy("overview.goal", { value: formatCount(goal.value) }),
    means: writtenLine(goal.meansKey, { goal: formatCount(goal.value) }),
  };
}
