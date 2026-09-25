// SPEC §4 (2026-09-20, #908) — the Overview tab's header.
//
// "the Discoverability Score with change and goal in the header". Two
// parts: today's date, the line that says what the screen is about and the
// line under it; and the score with its change, its goal, its band and a
// twelve-week trend.
//
// **The calm layer (SPEC §4 2026-09-24, #1070, board R12-4).** The two are
// two exports, not one `<header>`, because they are placed apart: from `md`
// up the head stands on the left and a compact score card beside it,
// vertically centred; on a phone the score card comes after the page
// waiting for review (R12-7). The page places them (`(tabs)/page.tsx`).
//
// **The score's own rule is unchanged** (§4.5's data rule, `carriedBy`): the
// number carries its change where a previous week was measured and its goal
// where none was. `renderValue` is still the one path from a `Measured` to a
// string, so an unmeasured score is the dash and its written line and never
// a zero.
//
// **It cannot overflow.** The head line is a `min-w-0` block that wraps; the
// score card is its own grid column, so a long head never squeezes the
// number, and the trend takes the width its own box gives it
// (docs/DESIGN.md's no-overflow rule: a number is never clamped, so the box
// changes instead).
import type React from "react";
import { TrendSparkline } from "@/ui/charts";
import { SCORE_BANDS } from "@/lib/presentation/bands";
import { BAND_TONE } from "@/ui/bands";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { writtenLine } from "../_shell/written";
import { SHELL_LOCALE } from "../_shell/format";
import { BADGE } from "./badges";
import { GOALS } from "./goals";
import { carriedBy, formatCount, renderValue } from "./present";
import type { OverviewModel, ScoreModule } from "./model";

const SCORE_LABEL = "overview.tile.score.label" satisfies CopyKey;
const TEST_ID = "overview-head";

/** Today, as the eyebrow states it: the weekday and the day of the month in
 *  the site's own zone. A date, so it is a value and carries no sentence. */
function formatToday(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(SHELL_LOCALE, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
}

export function ScoreHead(p: {
  head: OverviewModel["head"];
  today: Date;
  timeZone: string;
  /** The line under the head, already written, or `null`. */
  sub: string | null;
  className?: string;
}): React.JSX.Element {
  const line = writtenLine(p.head.key);
  const badge = p.head.badgeKey === undefined ? null : writtenLine(p.head.badgeKey);

  return (
    <header className={`flex min-w-0 flex-col gap-1 ${p.className ?? ""}`} data-testid={TEST_ID}>
      <p className="num text-xs font-semibold uppercase tracking-wide text-base-content/70">
        {formatToday(p.today, p.timeZone)}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <h1>{line ?? copy("shell.nav.overview")}</h1>
        {badge === null ? null : <span className={BADGE.ok}>{badge}</span>}
      </div>
      {p.sub === null ? null : (
        <p className="text-base text-base-content/70" data-testid="overview-head-sub">
          {p.sub}
        </p>
      )}
    </header>
  );
}

export function ScoreCard(p: { score: ScoreModule; className?: string }): React.JSX.Element {
  const label = copy(SCORE_LABEL);
  const value = renderValue(p.score.headline.value, SCORE_LABEL);
  const carried = carriedBy(p.score.headline, SCORE_LABEL);
  // The goal and what reaching it means, both stated whatever the change is:
  // §4.5's rule is that a value carries its delta *or* its goal, and the
  // header has room for both — the goal is the denominator the number is
  // read against, and `carriedBy` only offers it when there is no delta.
  const pin = GOALS[p.score.headline.goal];
  const goalValue = formatCount(pin.value);
  const goal = copy("overview.goal", { value: goalValue });
  const means = writtenLine(pin.meansKey, { goal: goalValue });

  return (
    <section
      className={`card card-border min-w-0 bg-base-100 ${p.className ?? ""}`}
      aria-label={label}
      data-testid="overview-score"
    >
      <div className="card-body gap-2 p-5">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/70">{label}</span>
          {value.isDash || p.score.band === null ? null : (
            <span className={BADGE[BAND_TONE[p.score.band]]}>{copy(SCORE_BANDS[p.score.band])}</span>
          )}
        </div>
        {value.isDash ? (
          <span className="text-sm text-base-content/70">{value.line ?? label}</span>
        ) : (
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="figure text-4xl leading-none">{value.text}</span>
            <span className="num text-sm text-base-content/70">{goal}</span>
            {carried.kind === "delta" ? (
              <span className={`${BADGE.ok} ms-auto`}>
                <span className="num">{copy(carried.markKey)}</span>
                <span className="num">{carried.text}</span>
              </span>
            ) : null}
          </div>
        )}
        <TrendSparkline
          points={p.score.trend}
          label={copy("overview.trend.label", {
            name: label,
            weeks: formatCount(p.score.trend.length),
          })}
        />
        {means === null ? null : <p className="text-xs text-base-content/70">{means}</p>}
      </div>
    </section>
  );
}
