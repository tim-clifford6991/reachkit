// BUILD §4.6 — "'Why this page' (search / asked / answered-today-by / you /
// done-when — all mono values)".
//
// Five rows, in §4.6's own order. Every label is a registry key; every
// value is customer or measured data and carries `.num`, which is the one
// mechanism §2.3's numeral rule is applied through ("Every numeral, date,
// URL, **search query** and code-like string is JetBrains Mono with
// tabular-nums").
//
// REQ-043 criterion 10, as disambiguated 2026-09-03: "one written line
// states the date they were measured, and that date is **not repeated
// separately beside each value**." So no row carries a date; the panel's
// one dim provenance line does, and it is rendered by `DayPanelView`
// beside these rows rather than inside them.
//
// `youStand` is a `Measured<number>` and goes through `renderMeasured` —
// the only way a measurement reaches a screen (BP-019). An outage renders
// the dash and its own written line, never a zero, and a measured zero
// renders as `0` because that is a measurement.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { renderMeasured } from "@/lib/presentation/measured";
import type { WhyThisPage as WhyFacts } from "./month";

/** One label/value pair. The label arrives already resolved from the
 *  registry — this component reads no key and writes no word, so there is
 *  no position here a sentence could be typed into. The value is always a
 *  value, and carries `.num` because §2.3 says every one of these is. */
function Row(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <p>
      <span>{p.label}</span> <span className="num">{p.children}</span>
    </p>
  );
}

export function WhyThisPage(p: { why: WhyFacts }): React.JSX.Element {
  const { why } = p;
  const you = renderMeasured(why.youStand, {
    format: (v) => String(v),
    // REQ-004 c6: nothing came back that could be read. The calendar shows
    // a stored measurement, so `not_attempted` is not reachable here — the
    // scan either produced the number or could not determine it.
    unmeasuredLine: "unmeasured.undeterminable",
    what: why.search,
  });

  return (
    <div data-testid="why-this-page">
      <p>{copy("calendar.why.title")}</p>
      <Row label={copy("calendar.why.search")}>{why.search}</Row>
      <Row label={copy("calendar.why.asked")}>{why.askedAs}</Row>
      <Row label={copy("calendar.why.answered-today-by")}>{why.answeredTodayBy.join(", ")}</Row>
      <Row label={copy("calendar.why.you")}>{you.text}</Row>
      {you.line === undefined ? null : <p className="rk-prov">{you.line}</p>}
      <Row label={copy("calendar.why.done-when")}>{why.doneWhen}</Row>
    </div>
  );
}
