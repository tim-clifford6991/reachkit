// SPEC §6 (2026-09-20, #908) — the AI answers tab's readings: since issue
// 1551 (owner, 2026-10-19), the published pages' own questions cited first,
// then the rate and this week's count.
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
// **A zero is quiet** (docs/DESIGN.md, the calm layer, #1089): a tile whose
// reading is zero or was never taken is a flat grey cell with its number at
// body size, the way the Search tab's are — never a white card with a big
// "0".
//
// **It cannot overflow.** One column on a phone, two at `sm` and three at
// `xl`; every tile is `min-w-0`, the names wrap inside their own column and no figure is
// clamped — the box changes instead (docs/DESIGN.md's no-overflow rule).
import type React from "react";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { ENGINE_LABEL } from "../_shell/page-target-words";
import { CLOSED, TILE_FIGURE, TILE_GRID, formatCount, renderValue } from "./present";
import { FULL_WINDOW, type AnswersModel } from "./answers-model";

const PAGES_CITED_LABEL = "overview.answers.pages-cited.label" satisfies CopyKey;
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
  /** Zero, or never taken: drawn flat and small. */
  quiet: boolean;
}): React.JSX.Element {
  // /70 ink: the softer 2026-09-25 ink at /60 is under axe's floor even on white.
  const ink = "text-base-content/70";
  const label = (
    // The tile's name is the product's own, not the customer's, so it wraps
    // rather than being clamped: two fixed phrases, and a name cut in half
    // is a name nobody can read.
    <span className={`min-w-0 pe-6 text-xs font-semibold tracking-wide uppercase ${ink}`}>
      {copy(p.labelKey)}
    </span>
  );
  const lines = p.lines.map((line) =>
    line === null ? null : (
      <p key={line} className={`text-xs ${ink}`}>
        {line}
      </p>
    )
  );
  return (
    <section
      className={p.quiet ? "card min-w-0 bg-base-200" : "card card-border min-w-0 bg-base-100"}
      data-testid={p.testId}
      data-quiet={p.quiet ? "" : undefined}
    >
      {p.figure === null ? (
        // A reading nobody took keeps its line in sight: it is what stands
        // where the number would, not a sentence about one.
        <div className="card-body gap-2 p-4">
          {label}
          <p className="text-sm text-base-content/70">{p.line ?? copy(p.labelKey)}</p>
          {lines}
        </div>
      ) : (
        // The lines explain the number, so they are closed under it (SPEC
        // §4, 2026-10-07, issue 1324).
        <details className={CLOSED.root}>
          <summary className={CLOSED.tile}>
            {label}
            <div className={TILE_FIGURE}>
              <span
                className={p.quiet ? "figure text-base leading-none text-base-content/70" : "figure text-3xl leading-none"}
                data-testid={`${p.testId}-value`}
              >
                {p.figure}
              </span>
              <span className={`num flex flex-wrap items-baseline gap-1 text-sm ${ink}`}>
                {p.against}
              </span>
            </div>
          </summary>
          <div className={CLOSED.tileBody}>{lines}</div>
        </details>
      )}
    </section>
  );
}

export function AnswerTiles(p: {
  model: AnswersModel;
  /** The tracked buyer prompts' own rate tile, once they carry the rate
   *  (D19, #1162): it stands where the twelve's four-week rate stood, so
   *  the rate is not drawn a second time and the row is two tiles either
   *  way — the shape the waiting screen holds (issue 1324). */
  rate?: React.ReactNode;
}): React.JSX.Element {
  const promptRate = p.rate ?? null;
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

  // Issue 1551: the published pages' own questions lead — the AI signal a
  // page moves first — beside the rate, which is brand reputation.
  const cited = renderValue(p.model.pagesCited.value, PAGES_CITED_LABEL);

  return (
    <div className={`grid min-w-0 gap-4 ${TILE_GRID.answers}`} data-testid="answers-tiles">
      <Tile
        labelKey={PAGES_CITED_LABEL}
        testId="answers-tile-pages-cited"
        figure={cited.isDash ? null : cited.text}
        against={copy("overview.answers.pages-cited.of", { of: formatCount(p.model.pagesCited.of) })}
        lines={[copy("overview.answers.pages-cited.means")]}
        line={copy("overview.answers.pages-cited.none")}
        quiet={cited.isDash || p.model.pagesCited.value.kind !== "measured"}
      />
      {promptRate !== null ? promptRate : <Tile
        labelKey={RATE_LABEL}
        testId="answers-tile-rate"
        figure={rate.isDash ? null : rate.text}
        against={asked.isDash ? null : copy("overview.answers.rate.of", { of: asked.text })}
        lines={[split, why]}
        line={rate.line ?? null}
        quiet={rate.isDash || p.model.rate.value.kind !== "measured" || p.model.rate.value.value === 0}
      />}
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
        quiet={week.isDash || p.model.week.value.kind !== "measured" || p.model.week.value.value === 0}
      />
    </div>
  );
}
