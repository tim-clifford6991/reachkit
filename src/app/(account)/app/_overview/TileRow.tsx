// BUILD §4.5 — three tiles, one headline number each.
//
// SPEC §4: every headline number has a change, a goal or a denominator.
// The score carries its delta (or goal) and its band; AI answers carry
// `n/12` and the goal; pages carry the count already ranking. Week 0 shows
// the deep pass's reading named as the starting measurement (#793), or a
// dash and the date the first reading is due where the deep pass took none.
//
// daisyUI `stat` and `badge` in the route (docs/DESIGN.md rule 1). The AI
// window is a CSS grid of weeks (DESIGN rule 2, issue 730): it is not a
// series, so it is not a chart.
import type React from "react";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { TOO_EARLY_WEEKS } from "@/lib/config/constants";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { Measured } from "@/lib/measure/measured";
import { formatDate } from "../_shell/format";
import { writtenLine } from "../_shell/written";
import { GOALS } from "./goals";
import { carriedBy, formatCount, formatDayOfMonth, renderValue, type Carried } from "./present";
import type { AiPresenceWindow, Module, ScoreModule } from "./model";
import { BAND_TONE } from "@/ui/bands";
import type { Tone } from "@/ui/types";

const SCORE_LABEL = "overview.tile.score.label" satisfies CopyKey;
const AI_LABEL = "overview.tile.ai-answers.label" satisfies CopyKey;
const PAGES_LABEL = "overview.tile.pages.label" satisfies CopyKey;
const SCORE_TEST_ID = "overview-tile-score";
const AI_TEST_ID = "overview-tile-ai-answers";
const PAGES_TEST_ID = "overview-tile-pages";
const CARRY_BESIDE = "beside";

const BADGE: Readonly<Record<Tone, string>> = {
  accent: "badge badge-primary",
  ok: "badge badge-success badge-soft",
  warn: "badge badge-warning badge-soft",
  bad: "badge badge-error badge-soft",
  neutral: "badge badge-ghost",
};

/** The carried value as a badge: a delta is the customer's own movement
 *  (success), a goal is a target (ghost). */
function carriedBadge(carried: Carried): React.JSX.Element {
  if (carried.kind === "delta") {
    return (
      <span className={BADGE.ok}>
        <span className="num">{copy(carried.markKey)}</span>
        <span className="num">{carried.text}</span>
      </span>
    );
  }
  return (
    <span className={BADGE.neutral}>
      <span className="num">{carried.text}</span>
    </span>
  );
}

/** What reaching the goal means, under the row. A delta carries none. */
function meansLine(carried: Carried): React.JSX.Element | null {
  if (carried.kind !== "goal" || carried.means === null) return null;
  return <p className="text-xs text-base-content/60">{carried.means}</p>;
}

/** One tile: a card holding one daisyUI `stat`. `beside` rides on the
 *  figure's row as its description. */
function Tile(p: {
  label: string;
  testId: string;
  figure: React.ReactNode | null;
  beside: React.ReactNode;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="card card-border min-w-0 bg-base-100" data-testid={p.testId}>
      <div className="card-body gap-3 p-5">
        <div className="stats" aria-label={p.label}>
          <div className="stat p-0">
            <div className="stat-title text-xs font-semibold uppercase tracking-wide">{p.label}</div>
            <div className="flex flex-wrap items-baseline gap-2" data-carry={CARRY_BESIDE}>
              <div className="stat-value num">{p.figure ?? "—"}</div>
              {p.beside === null ? null : (
                <div className="stat-desc flex flex-wrap items-center gap-2 whitespace-normal">{p.beside}</div>
              )}
            </div>
          </div>
        </div>
        {p.children}
      </div>
    </section>
  );
}

/** Week 0's two dates, formatted in the site's zone. */
interface WeekZeroDates {
  startingOn: string;
  firstDue: string;
}

/** Week 0's line under a tile: the starting measurement where the deep
 *  pass took one (#793), otherwise the tile's own first-due line. */
function weekZeroLine(
  weekZero: WeekZeroDates | null,
  isDash: boolean,
  dueLine: (due: string) => string | null
): string | null {
  if (weekZero === null) return null;
  if (isDash) return dueLine(weekZero.firstDue);
  return writtenLine("overview.tile.starting", { on: weekZero.startingOn, due: weekZero.firstDue });
}

function ScoreTile(p: { score: ScoreModule; weekZero: WeekZeroDates | null }): React.JSX.Element {
  const label = copy(SCORE_LABEL);
  const value = renderValue(p.score.headline.value, SCORE_LABEL);
  const carried = carriedBy(p.score.headline, SCORE_LABEL);
  const firstDue = weekZeroLine(p.weekZero, value.isDash, (due) =>
    writtenLine("overview.tile.score.first-due", { due })
  );

  return (
    <Tile
      label={label}
      testId={SCORE_TEST_ID}
      figure={value.isDash ? null : value.text}
      beside={
        value.isDash ? (
          value.line ?? label
        ) : (
          <>
            {carriedBadge(carried)}
            {/* A band is a reading of a score: none beside a dash. */}
            {p.score.band === null ? null : (
              <span className={BADGE[BAND_TONE[p.score.band]]}>{copy(SCORE_BANDS[p.score.band])}</span>
            )}
          </>
        )
      }
    >
      {value.isDash ? null : meansLine(carried)}
      {firstDue === null ? null : <p className="text-xs text-base-content/60">{firstDue}</p>}
    </Tile>
  );
}

/** The window as the matrix's one row. An unmeasured week is `muted`, never
 *  a miss; a change is a `break`, which is a rule and not a reading. */
type WeekCell = "cited" | "not-cited" | "muted" | "break" | "goal";

/** One cell per window entry. A break is the column a change of domain
 *  stands in, never a reading; a week with no measurement is muted, never a
 *  miss. The shortfall to the goal is drawn as dashed goal dots over the
 *  first weeks the customer was not cited — a distance, not a reading, so
 *  the tile's figure already says it and no cell is red. */
function presenceCells(window: AiPresenceWindow, goal: number): readonly WeekCell[] {
  const cells: WeekCell[] = window.entries.map((entry) =>
    entry.kind === "break"
      ? "break"
      : entry.week.present === null
        ? "muted"
        : entry.week.present
          ? "cited"
          : "not-cited"
  );
  let short = Math.max(0, goal - cells.filter((c) => c === "cited").length);
  return cells.map((cell) => {
    if (cell !== "not-cited" || short === 0) return cell;
    short -= 1;
    return "goal";
  });
}

const WEEK_CELL_CLASS: Readonly<Record<WeekCell, string>> = Object.freeze({
  cited: "bg-(--chart-you)",
  "not-cited": "border border-base-300 bg-base-100",
  muted: "border border-dashed border-base-300 bg-base-200",
  break: "border border-dashed border-base-content/40",
  goal: "border-2 border-dashed border-(--chart-goal)",
});

/** The AI window: one row of week cells over their dates, and the goal's
 *  own name at the end. Every cell carries its date and state as its name. */
function PresenceWeeks(p: {
  cells: readonly WeekCell[];
  labels: readonly string[];
  goalName: string;
  label: string;
}): React.JSX.Element {
  const columns = { gridTemplateColumns: `repeat(${Math.max(p.cells.length, 1)}, minmax(0.75rem, 1.25rem)) auto` };
  return (
    <div role="table" aria-label={p.label} className="grid w-max items-center gap-x-1 gap-y-1" style={columns}>
      <div role="row" className="contents">
        {p.cells.map((cell, c) => (
          <div role="cell" key={c} data-cell={cell} title={p.labels[c] ?? ""} aria-label={p.labels[c] ?? ""}>
            <div aria-hidden="true" className={`aspect-square rounded-sm ${WEEK_CELL_CLASS[cell]}`} />
          </div>
        ))}
        <div aria-hidden="true" />
      </div>
      <div role="row" className="contents">
        {p.labels.map((week, c) => (
          <span role="columnheader" key={c} className="num border-t border-base-300 pt-1 text-center text-[0.625rem] text-base-content/50">
            {week}
          </span>
        ))}
        <span className="num pl-2 text-[0.625rem] whitespace-nowrap text-(--chart-goal)">{p.goalName}</span>
      </div>
    </div>
  );
}

export function TileRow(p: {
  score: ScoreModule;
  /** Present only before the first weekly pass has run. */
  weekZero?: { firstDueOn: Date; startingOn: Date } | null;
  aiAnswers: Module<number> & { window: AiPresenceWindow };
  pagesPublished: Module<number>;
  timeZone: string;
}): React.JSX.Element {
  const weekZero: WeekZeroDates | null =
    p.weekZero === undefined || p.weekZero === null
      ? null
      : {
          startingOn: formatDate(p.weekZero.startingOn, p.timeZone),
          firstDue: formatDate(p.weekZero.firstDueOn, p.timeZone),
        };

  // AI answers: n/12, the goal, and the window drawn under it.
  const aiLabel = copy(AI_LABEL);
  const aiValue = renderValue(p.aiAnswers.headline.value, AI_LABEL);
  const aiCarried = carriedBy(p.aiAnswers.headline, AI_LABEL);
  const outOf = formatCount(p.aiAnswers.window.of);
  const windowLine = writtenLine("overview.tile.ai-answers.window", { weeks: aiValue.text, of: outOf });
  const firstPass = weekZeroLine(weekZero, aiValue.isDash, () =>
    writtenLine("overview.tile.ai-answers.first-pass")
  );
  const weekLabels = p.aiAnswers.window.entries.map((entry) =>
    formatDayOfMonth(entry.kind === "break" ? entry.marker.on : entry.week.weekStart, p.timeZone)
  );

  // Pages: the count, beside it the count already ranking, under it the
  // too-early remainder. Neither line renders where ranking was not taken.
  const pagesLabel = copy(PAGES_LABEL);
  const pagesValue = renderValue(p.pagesPublished.headline.value, PAGES_LABEL);
  const rankingValue = p.pagesPublished.context?.[0];
  const rankingRendered =
    rankingValue === undefined ? null : renderValue(rankingValue.value as Measured<number>, PAGES_LABEL);
  const ranking =
    rankingValue === undefined || rankingRendered === null || rankingRendered.isDash
      ? null
      : writtenLine(rankingValue.label, { count: rankingRendered.text });
  const tooEarly =
    ranking === null
      ? null
      : writtenLine("overview.tile.pages.too-early", { weeks: formatCount(TOO_EARLY_WEEKS) });
  const firstReview = weekZero === null ? null : writtenLine("overview.tile.pages.first-review");

  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-3" data-testid="overview-tiles">
      <ScoreTile score={p.score} weekZero={weekZero} />

      <Tile
        label={aiLabel}
        testId={AI_TEST_ID}
        figure={aiValue.isDash ? null : `${aiValue.text}/${outOf}`}
        beside={aiValue.isDash ? (aiValue.line ?? aiLabel) : carriedBadge(aiCarried)}
      >
        {aiValue.isDash ? null : meansLine(aiCarried)}
        {firstPass === null ? null : <p className="text-xs text-base-content/60">{firstPass}</p>}
        {windowLine === null ? null : <p className="num text-xs text-base-content/60">{windowLine}</p>}
        <div className="min-w-0 overflow-x-auto">
          <PresenceWeeks
            cells={presenceCells(p.aiAnswers.window, GOALS.ai_answers.value)}
            labels={weekLabels}
            goalName={copy("overview.goal", { value: formatCount(GOALS.ai_answers.value) })}
            label={aiLabel}
          />
        </div>
      </Tile>

      <Tile
        label={pagesLabel}
        testId={PAGES_TEST_ID}
        figure={pagesValue.isDash ? null : pagesValue.text}
        beside={
          pagesValue.isDash ? (
            (pagesValue.line ?? pagesLabel)
          ) : ranking === null ? null : (
            <span className={BADGE.ok}>{ranking}</span>
          )
        }
      >
        {tooEarly === null ? null : <p className="text-xs text-base-content/60">{tooEarly}</p>}
        {firstReview === null ? null : <p className="text-xs text-base-content/60">{firstReview}</p>}
      </Tile>
    </div>
  );
}
