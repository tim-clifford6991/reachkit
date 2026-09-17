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
// measured zero renders as `0` because that is a measurement. The volume
// and difficulty rows issue 867 added are read the same way.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { renderMeasured } from "@/lib/presentation/measured";
import { ENGINE_LABEL, ENGINE_STANDING, formatCount } from "../_shell/page-target-words";
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
  // The two numbers this block gained in issue 867. Both are measurements
  // and both go through `renderMeasured`: a search nobody could read a
  // difficulty for shows the dash and its line, never a 0 — which would
  // read as "nothing to beat".
  const volume = renderMeasured(why.volume, {
    format: formatCount,
    unmeasuredLine: "unmeasured.undeterminable",
    what: why.search,
  });
  const difficultyValue = renderMeasured(why.difficulty, {
    format: (v) => String(v),
    unmeasuredLine: "unmeasured.undeterminable",
    what: why.search,
  });
  // Against the ceiling this site is judged by, where the row carries one:
  // a difficulty is not a verdict until it is beside its bar.
  const difficulty =
    difficultyValue.isDash || why.ceiling === null
      ? difficultyValue.text
      : copy("calendar.why.difficulty.of-ceiling", {
          difficulty: difficultyValue.text,
          ceiling: String(why.ceiling),
        });

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
        {/* Issue 867: what this page is optimising for — the demand, the
            difficulty against this site's own ceiling (§6, issue 858), and
            where the AI engines stood. Each is a stored measurement and
            renders its own unmeasured arm, never a zero. */}
        <Row label={copy("calendar.why.volume")}>{volume.text}</Row>
        <Row label={copy("calendar.why.difficulty")} phrase>
          {difficulty}
        </Row>
        <Row label={copy("calendar.why.answered-today-by")} phrase>
          {why.answeredTodayBy.join(", ")}
        </Row>
        {why.engines.length === 0 ? null : (
          <Row label={copy("calendar.why.engines")} phrase>
            {why.engines
              .map((engine) =>
                copy("calendar.why.engine.line", {
                  engine: copy(ENGINE_LABEL[engine.engine]),
                  standing: copy(ENGINE_STANDING[engine.standing]),
                })
              )
              .join(", ")}
          </Row>
        )}
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
