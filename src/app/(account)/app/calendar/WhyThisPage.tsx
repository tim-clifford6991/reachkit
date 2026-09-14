// SPEC §7 — "Why this page": search / asked / answered today by / you /
// done when.
//
// A definition list in a two-column grid, in that order. Every label is a
// registry key; every value is customer or measured data and carries `.num`
// (the mono face), except "done when", which is a sentence rather than a
// value. Values made of several words carry `num-phrase` so they fold where
// language folds instead of pushing the 18rem panel sideways (#297, #307).
//
// No row carries a date: the panel's one provenance line does (REQ-043 c10).
//
// `youStand` is a `Measured<number>` and goes through `renderMeasured` — an
// outage renders the dash and its own written line, never a zero, and a
// measured zero renders as `0` because that is a measurement.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { renderMeasured } from "@/lib/presentation/measured";
import type { WhyThisPage as WhyFacts } from "./month";

function Row(p: {
  label: string;
  /** A value made of words — folds between them. Opted into per value:
   *  whether a string is one token or a phrase is the caller's judgement. */
  phrase?: boolean;
  /** A sentence, not a value — no mono face. */
  sentence?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const value = p.sentence === true ? "min-w-0" : p.phrase === true ? "num num-phrase min-w-0" : "num min-w-0";
  return (
    <>
      <dt className="opacity-60">{p.label}</dt>
      <dd className={value}>{p.children}</dd>
    </>
  );
}

export function WhyThisPage(p: { why: WhyFacts }): React.JSX.Element {
  const { why } = p;
  const you = renderMeasured(why.youStand, {
    format: (v) => String(v),
    // The calendar shows a stored measurement, so `not_attempted` is not
    // reachable here — the scan either produced the number or could not
    // determine it.
    unmeasuredLine: "unmeasured.undeterminable",
    what: why.search,
  });

  return (
    <div className="flex min-w-0 flex-col gap-2" data-testid="why-this-page">
      <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">
        {copy("calendar.why.title")}
      </h3>
      <dl className="grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <Row label={copy("calendar.why.search")} phrase>
          {why.search}
        </Row>
        <Row label={copy("calendar.why.asked")} phrase>
          {why.askedAs}
        </Row>
        <Row label={copy("calendar.why.answered-today-by")} phrase>
          {why.answeredTodayBy.join(", ")}
        </Row>
        <Row label={copy("calendar.why.you")}>{you.text}</Row>
        <Row label={copy("calendar.why.done-when")} sentence>
          {why.doneWhen}
        </Row>
      </dl>
      {/* An outage's own written line, under the list rather than in it. */}
      {you.line === undefined ? null : <p className="text-xs opacity-70">{you.line}</p>}
    </div>
  );
}
