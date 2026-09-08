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
// **It is a definition list on a hairline-separated block** (issue #354,
// approved screen S15). Five keys and five values: `<dl>` is what a
// key/value list is, and the approved `.why` draws it as a two-column grid
// with the key at the near edge in the quiet ink and the value beside it.
// The rows were `<p>`s with the label and the value inline before, which
// read as five sentences rather than as the page's own record.
//
// Both columns are mono, and that is the approved sheet's own reading of
// §2.3 rather than a widening of it: a search query, the question as asked,
// the engines that answered and a count are all values, and the keys beside
// them are fixed labels for values. `done when` is the exception the type
// already knows about — see `Sentence` below.
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
function Row(p: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <dt>{p.label}</dt>
      <dd className="num">{p.children}</dd>
    </>
  );
}

/** One label/**sentence** pair — the same row, without `.num`.
 *
 *  `.num` is `white-space: nowrap` since #297, because a value has no
 *  boundaries and every place it could fold is a place it would be read as
 *  a different string. A criterion is not a value: "Named in an AI answer
 *  for the target question within 6 weeks" is a sentence, and §2.3's mono
 *  list is numerals, dates, URLs, search queries and code-like strings —
 *  none of which it is. It was carrying `.num` all the same, and the
 *  nowrap rule is what made that visible: it pushed the calendar's day
 *  panel sideways at 320 and 1280 and the sweep reported the document
 *  scrolling (check 1) and the line clipped (check 3).
 *
 *  So the fix is not a wider box or an exemption — it is that this row
 *  never held a value. The rows above it still do: a search query, the
 *  question as asked, the engines that answered, a count. */
function Sentence(p: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <dt>{p.label}</dt>
      <dd>{p.children}</dd>
    </>
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
    <div className="flex flex-col gap-3" data-testid="why-this-page">
      <p className="eyebrow rk-daypanel-eyebrow">{copy("calendar.why.title")}</p>
      <dl className="rk-daypanel-why">
        <Row label={copy("calendar.why.search")}>{why.search}</Row>
        <Row label={copy("calendar.why.asked")}>{why.askedAs}</Row>
        <Row label={copy("calendar.why.answered-today-by")}>
          {why.answeredTodayBy.join(", ")}
        </Row>
        <Row label={copy("calendar.why.you")}>{you.text}</Row>
        <Sentence label={copy("calendar.why.done-when")}>{why.doneWhen}</Sentence>
      </dl>
      {/* An outage's own written line, under the list rather than in it: it
          is a sentence about why a value is a dash, and a `<dd>` holding a
          sentence beside four values is the defect #297 already found in
          `done when`. */}
      {you.line === undefined ? null : <p className="rk-prov">{you.line}</p>}
    </div>
  );
}
