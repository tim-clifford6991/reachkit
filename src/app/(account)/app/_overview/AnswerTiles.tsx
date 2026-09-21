// SPEC §6 (2026-09-20, #908) — the AI answers tab's two readings.
//
// "A rolling four-week rate — answers that name or link the site over all
// answers asked — beside this week's n of 12; named and linked are counted
// apart."
//
// **§4's data rule holds on both**: every headline number has a change, a
// goal or a denominator. The rate carries its denominator — the answers
// that could actually be read — and the week carries both its twelve and
// its goal of six.
//
// **Neither carries a change, and that is the rule rather than an
// omission.** REQ-041 c12 allows the product one reading of AI-answer
// movement, and a week-over-week arrow on a four-week rate would contradict
// the sentence printed under it: one week alone is too noisy to trust.
//
// **Every number goes through `renderValue`**, so a reading nobody took is
// the dash and its own written line and never a zero.
//
// **It cannot overflow.** One column on a phone and two at `sm`; both tiles
// are `min-w-0`, the names wrap inside their own column and no figure is
// clamped — the box changes instead (docs/DESIGN.md's no-overflow rule).
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { formatCount, renderValue } from "./present";
import { FULL_WINDOW, type AnswersModel } from "./answers-model";

const RATE_LABEL = "overview.answers.rate.label" satisfies CopyKey;
/** The week tile's name is the Overview's own tile name, read from the same
 *  key: two spellings of "Questions that name you" is how two screens come
 *  to call one reading two things. */
const WEEK_LABEL = "overview.tile.questions.label" satisfies CopyKey;

/** One tile: its name, the figure, what the figure is read against, and the
 *  lines under it. A tile whose reading was never taken shows the written
 *  line where the number would stand. */
function Tile(p: {
  labelKey: CopyKey;
  testId: string;
  figure: string | null;
  /** Never a sentence — the denominator, or the goal. */
  against: React.ReactNode;
  lines: readonly (string | null)[];
  /** The written line where the reading was not taken. */
  line: string | null;
}): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="card-body gap-2 p-4">
        {/* The tile's name is the product's own, not the customer's, so it
            wraps rather than being clamped: two fixed phrases, and a name
            cut in half is a name nobody can read. */}
        <span className="min-w-0 text-xs font-semibold tracking-wide uppercase text-base-content/60">
          {copy(p.labelKey)}
        </span>
        {p.figure === null ? (
          <p className="text-sm text-base-content/70">{p.line ?? copy(p.labelKey)}</p>
        ) : (
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="num text-3xl leading-none font-bold" data-testid={`${p.testId}-value`}>
              {p.figure}
            </span>
            <span className="num flex flex-wrap items-baseline gap-1 text-sm text-base-content/60">
              {p.against}
            </span>
          </div>
        )}
        {p.lines.map((line) =>
          line === null ? null : (
            <p key={line} className="text-xs text-base-content/60">
              {line}
            </p>
          )
        )}
      </div>
    </section>
  );
}

export function AnswerTiles(p: { model: AnswersModel }): React.JSX.Element {
  const rate = renderValue(p.model.rate.value, RATE_LABEL);
  const asked = renderValue(p.model.rate.of, RATE_LABEL);
  const week = renderValue(p.model.week.value, WEEK_LABEL);

  // Why four weeks, in one line, with the shape of the window in it:
  // twelve questions × three engines × four passes. The window is the pin,
  // and what was actually read is the denominator beside the figure — so
  // this sentence never has to say "the last 1 weeks", and never claims a
  // measurement it did not take either.
  const why = copy("overview.answers.rate.means", {
    weeks: formatCount(FULL_WINDOW.weeks),
    questions: formatCount(FULL_WINDOW.questions),
    engines: formatCount(FULL_WINDOW.engines),
  });
  // Named and linked, counted apart (§6, 2026-09-20). Drawn only where the
  // rate itself was taken: a split of a number nobody measured is two
  // zeroes wearing a measurement's clothes.
  const split = rate.isDash
    ? null
    : copy("overview.answers.rate.split", {
        linked: formatCount(p.model.rate.linked),
        named: formatCount(p.model.rate.named),
      });

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2" data-testid="answers-tiles">
      <Tile
        labelKey={RATE_LABEL}
        testId="answers-tile-rate"
        figure={rate.isDash ? null : rate.text}
        against={asked.isDash ? null : copy("overview.answers.rate.of", { of: asked.text })}
        lines={[split, why]}
        line={rate.line ?? null}
      />
      <Tile
        labelKey={WEEK_LABEL}
        testId="answers-tile-week"
        figure={week.isDash ? null : week.text}
        against={
          <>
            <span>{copy("overview.tile.ai-answers.of", { of: formatCount(p.model.week.of) })}</span>
            <span>{copy("overview.goal", { value: formatCount(p.model.week.goal) })}</span>
          </>
        }
        lines={[
          copy("overview.answers.week.means", { engine: copy(ENGINE_LABEL[p.model.week.engine]) }),
        ]}
        line={week.line ?? null}
      />
    </div>
  );
}
