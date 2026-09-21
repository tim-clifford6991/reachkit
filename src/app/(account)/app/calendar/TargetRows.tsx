// SPEC §7 (2026-09-20, #908, issue 930) — the **one** renderer of what a
// page is for. `target.ts` is the one projection behind it.
//
// It replaces two: `calendar/WhyThisPage.tsx` and the `Facts` half of
// `draft/[draftId]/TargetBlock.tsx`, which drew the same facts as two
// definition lists with different rows, a different order and two opinions
// about which values fold. Both screens now draw this, so a row added here
// reaches both and a fact cannot be worded twice.
//
// **Label-and-value rows, never sentences** (SPEC §7, 2026-09-20): a fixed
// label column and a value that clamps to one line. The clamp carries
// `rk-cal-label`, the truncation this screen has declared to the layout
// sweep since #354 — the whole string stays in the document, on the row's
// own `title`, so a cut line is a cut *line* and never a lost value.
//
// **Every number goes through `renderMeasured`** (REQ-004): a difficulty
// the vendor never gave draws the dash and its own written line, never a
// `0`, which would read as "nothing to beat". The one exception is a
// measured **zero** place, which §6.6's cold-start law makes a measurement
// — the site holds none — and which is said in words ("Not ranking")
// rather than as a `0` that would read as a position.
//
// daisyUI classes and Tailwind utilities in the file that renders (rule 1):
// no wrapper, no sheet, no token.
import type React from "react";
import { copy } from "@/lib/presentation/copy";
import { BAND_LABELS } from "@/lib/presentation/bands";
import { renderMeasured } from "@/lib/presentation/measured";
import type { Measured } from "@/lib/measure/measured";
import { ENGINE_LABEL, ENGINE_STANDING, formatCount } from "../_shell/page-target-words";
import type { EngineStanding } from "@/lib/opportunities/types";
import type { TargetFacts } from "./target";

/** The daisyUI badge each engine standing wears. Total over the four, so a
 *  fifth standing is a compile error here rather than an unmarked chip.
 *  Colour is never the whole statement — every chip carries its word. */
const STANDING_BADGE: Readonly<Record<EngineStanding, string>> = Object.freeze({
  names_you: "badge-success",
  names_others: "badge-warning",
  no_answer: "badge-ghost",
  unmeasured: "badge-ghost",
});

/**
 * One row: a label of fixed width, and its value.
 *
 * **Three kinds, and the difference is whether the value can grow.**
 * `docs/DESIGN.md`'s no-overflow rule puts it exactly: "a label that can
 * grow (a title, a domain, a search) is clamped to one or two lines with an
 * ellipsis; a number is never clamped, so the box changes instead". So:
 *
 *   clamp  a search, a question, a rival's domain, an acceptance test —
 *          unbounded, so it is cut to one or two lines with the whole
 *          string on the row's own `title`. `rk-cal-label` is the
 *          truncation this screen declared to the layout sweep in #354,
 *          which is what makes a cut line a cut *line* and not a loss.
 *   value  a count, a difficulty, a place — bounded, set in the mono face
 *          (§2.3) and **never clamped**: the box folds instead
 *          (`num-phrase`). The sweep says the same thing mechanically, and
 *          more strongly: a truncated value is an offender whether or not
 *          its class is allow-listed, because a value cut in half is a
 *          different value.
 *   text   a band word, which is one of a closed set and needs neither.
 *
 * **The value is the row's own text node, with no element between.** A
 * clamping box with an element inside it reports that element as escaping
 * it the moment the text is long enough — the clip is on the box and the
 * child keeps its full height — so the box that clips holds the text
 * itself, and there is nothing inside it to escape.
 */
function Row(p: {
  label: string;
  value: string;
  kind: "clamp" | "value" | "text";
  /** Two lines rather than one, for a clamped value that is a sentence. */
  lines?: 2;
  testId: string;
}): React.JSX.Element {
  const shape =
    p.kind === "value"
      ? "num num-phrase"
      : p.kind === "text"
        ? ""
        : `rk-cal-label ${p.lines === 2 ? "line-clamp-2" : "truncate"}`;
  return (
    <>
      <dt className="min-w-0 self-center text-xs font-semibold opacity-60">{p.label}</dt>
      <dd
        className={`min-w-0 self-center text-sm ${shape}`}
        title={p.kind === "clamp" ? p.value : undefined}
        data-testid={p.testId}
      >
        {p.value}
      </dd>
    </>
  );
}

function Eyebrow(p: { children: React.ReactNode }): React.JSX.Element {
  // `.eyebrow` rather than a size utility: `src/ui/type.css` sets `h3`'s
  // size unlayered, and a class beats an element selector (issue #941's
  // finding, applied rather than changed — this PR touches no heading rule).
  return <h3 className="eyebrow">{p.children}</h3>;
}

/** A place, as this screen states it. Three arms and no fourth: a measured
 *  position is `#n`; a measured zero is §6.6's cold start, in words; an
 *  unmeasured one is the dash, with the line the caller renders. */
function place(
  value: Measured<number>,
  what: string
): { text: string; line: string | undefined } {
  if (value.kind === "zero") return { text: copy("calendar.why.not-ranking"), line: undefined };
  const rendered = renderMeasured(value, {
    format: (v) => `#${String(v)}`,
    unmeasuredLine: "unmeasured.undeterminable",
    what,
  });
  return { text: rendered.text, line: rendered.line };
}

export function TargetRows(p: { facts: TargetFacts }): React.JSX.Element {
  const { facts } = p;

  const volume = renderMeasured(facts.volume, {
    format: formatCount,
    unmeasuredLine: "unmeasured.undeterminable",
    what: facts.search,
  });
  const volumeText = volume.isDash
    ? volume.text
    : copy("calendar.why.volume.value", { count: volume.text });

  const difficulty = renderMeasured(facts.difficulty, {
    format: (v) => String(v),
    unmeasuredLine: "unmeasured.undeterminable",
    what: facts.search,
  });
  // A difficulty is not a verdict until it is beside the bar this site is
  // judged against (§6, issue 858). Where the row carries no ceiling it is
  // the number alone, never a limit nobody measured this page against.
  const difficultyText =
    difficulty.isDash || facts.ceiling === null
      ? difficulty.text
      : copy("calendar.why.difficulty.of-ceiling", {
          difficulty: difficulty.text,
          ceiling: String(facts.ceiling),
        });

  const rival = facts.bestRival;
  const rivalPlace = rival === null ? null : place(rival.position, rival.domain);
  const rivalText =
    rival === null || rivalPlace === null
      ? null
      : copy("calendar.why.answered-today-by.value", {
          domain: rival.domain,
          // The key writes the `#`; the place already carries one where it
          // is a position, and carries a word where it is not.
          position: rivalPlace.text.startsWith("#") ? rivalPlace.text.slice(1) : rivalPlace.text,
        });

  const you = facts.youStand === null ? null : place(facts.youStand, facts.search);

  // Each outage's own written line, under the list rather than inside it: a
  // row states a value, and why there is none is a sentence.
  const outages = [volume.line, difficulty.line, rivalPlace?.line, you?.line].filter(
    (line): line is string => line !== undefined && line !== null
  );

  return (
    // REQ-043 c8's "Why this page" is what this block **is**, and since the
    // 2026-09-20 redesign the screen says so to a reader rather than in a
    // heading: the visible heads are the two groups ("Search", "AI
    // answers") and the block's own name is its accessible one.
    <div
      className="flex min-w-0 flex-col gap-3"
      role="group"
      aria-label={copy("calendar.why.title")}
      data-testid="target-rows"
    >
      <Eyebrow>{copy("calendar.panel.search")}</Eyebrow>
      <dl className="grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
        <Row
          label={copy("calendar.why.search")}
          value={facts.search}
          kind="clamp"
          testId="row-search"
        />
        <Row
          label={copy("calendar.why.asked")}
          value={facts.askedAs}
          kind="clamp"
          lines={2}
          testId="row-asked"
        />
        <Row
          label={copy("calendar.why.volume")}
          value={volumeText}
          kind="value"
          testId="row-volume"
        />
        <Row
          label={copy("calendar.why.difficulty")}
          value={difficultyText}
          kind="value"
          testId="row-difficulty"
        />
        {rival === null || rivalText === null ? null : (
          <Row
            label={copy("calendar.why.answered-today-by")}
            value={rivalText}
            kind="clamp"
            testId="row-best-rival"
          />
        )}
        {you === null ? null : (
          <Row
            label={copy("calendar.why.you")}
            value={you.text}
            kind="value"
            testId="row-you"
          />
        )}
        {/* The band through `BAND_LABELS` (ADR-001) — never a word this
            component writes. A word from a closed set, so it is stated as
            one: a `badge` here carries its own padding into a row that
            clamps, which is #944's defect in a second place. */}
        <Row
          label={copy("calendar.why.band")}
          value={copy(BAND_LABELS.winnability[facts.winnability])}
          kind="text"
          testId="row-band"
        />
        <Row
          label={copy("calendar.why.done-when")}
          value={facts.doneWhen}
          kind="clamp"
          lines={2}
          testId="row-done-when"
        />
      </dl>

      {facts.engines.length === 0 ? null : (
        <>
          <Eyebrow>{copy("calendar.why.engines")}</Eyebrow>
          <ul className="flex min-w-0 flex-col gap-1.5" data-testid="target-engines">
            {facts.engines.map((engine) => (
              <li
                key={engine.engine}
                className="flex min-w-0 items-center gap-2"
                // The engine and its standing as one phrase, for a pointer
                // and for a reader who meets the row as two fragments. The
                // row draws them as a name and a chip, because a chip is
                // where this screen states a standing; the sentence that
                // joins them is still the registry's.
                title={copy("calendar.why.engine.line", {
                  engine: copy(ENGINE_LABEL[engine.engine]),
                  standing: copy(ENGINE_STANDING[engine.standing]),
                })}
                data-testid={`engine-${engine.engine}`}
              >
                <span className="rk-cal-label min-w-0 grow truncate text-sm">
                  {copy(ENGINE_LABEL[engine.engine])}
                </span>
                <span className={`badge badge-sm shrink-0 ${STANDING_BADGE[engine.standing]}`}>
                  {copy(ENGINE_STANDING[engine.standing])}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {outages.map((line) => (
        <p key={line} className="text-xs opacity-70">
          {line}
        </p>
      ))}
    </div>
  );
}
