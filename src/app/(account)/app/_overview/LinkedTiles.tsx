// SPEC §4 (2026-09-20, #908) — the three tiles, each one a door.
//
// "three tiles with a trend — searches you appear for, questions that name
// you, your nearest rival's lead — each opening its tab."
//
// Each tile is an `<a>`, not a card with a link inside it: the whole box is
// the control, which is what "every part opens the screen behind it" means,
// and a nested control inside a link is not something a keyboard can reach
// twice.
//
// **§4.5's data rule holds on all three**: a value carries its change or its
// goal, never bare. Searches carry both (goal 400, and the week's delta
// where one was taken); questions carry `n` of the window's twelve and their
// goal of six, and never a change — REQ-041 c12 forbids a second reading of
// AI-answer movement anywhere on this screen, which is why the model's
// headline has no `delta` to draw; the rival lead carries `was 1.5×`, which
// is its change.
//
// **Every number goes through `renderValue`**, so a reading nobody took is
// the dash and its own written line and never a zero.
//
// **The calm layer (SPEC §4 2026-09-24, #1070, boards R12-4 · R12-7).**
// Each tile lifts and nudges its arrow (`CARD_LIFT`, #1064), its trend draws
// once; the tab's name stays in the
// link for a screen reader and the arrow says it to the eye. On a phone the
// first two tiles share a row and the rival's lead spans the next — the
// phone board's three; each keeps its trend.
//
// **It cannot overflow.** Two columns below `lg` and three above it; every
// tile is `min-w-0`, its name wraps inside its own column and its figure is
// never clamped — the box changes instead (docs/DESIGN.md's no-overflow
// rule).
import type React from "react";
import { ChevronRight } from "lucide-react";
import { TrendSparkline } from "@/ui/charts";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import type { Measured } from "@/lib/measure/measured";
import { BADGE } from "./badges";
import { GOALS } from "./goals";
import { carriedBy, formatCount, renderValue } from "./present";
import type { AiPresenceWindow, Module, OverviewModel } from "./model";
import { TAB_COPY_KEY, TAB_HREF, type OverviewTab } from "./tabs";
import type { AbsoluteRival, RatioRival, RivalGapModule } from "./rivals";
import { ANSWER_RATE_WEEKS, MENTION_RATE_MIN_WEEKS } from "@/lib/config/constants";
import { percent, type PromptsModel } from "./prompts-model";

const SEARCHES_LABEL = "overview.tile.searches.label" satisfies CopyKey;
const QUESTIONS_LABEL = "overview.tile.questions.label" satisfies CopyKey;
const RIVALS_LABEL = "overview.tile.rivals.label" satisfies CopyKey;
const MENTION_RATE_LABEL = "overview.tile.mention-rate.label" satisfies CopyKey;

/** What a tile is read against, drawn bare beside the number: the goal, the
 *  window's denominator, the previous reading. Values, never a sentence. */
function Against(p: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="num flex flex-wrap items-baseline gap-1 text-sm text-base-content/70">
      {p.children}
    </span>
  );
}

/** A change, as a tile draws one. */
function Change(p: { markKey: CopyKey; text: string }): React.JSX.Element {
  return (
    <span className={BADGE.ok}>
      <span className="num">{copy(p.markKey)}</span>
      <span className="num">{p.text}</span>
    </span>
  );
}

/** One tile. The head names it and the tab it opens; the figure row holds
 *  the number, what it is read against and its change; under them one line
 *  and the trend. A tile whose reading was never taken shows the written
 *  line where the number would stand. */
function Tile(p: {
  label: string;
  tab: OverviewTab;
  testId: string;
  /** `null` where the reading was not taken. */
  figure: string | null;
  against?: React.ReactNode;
  change?: React.ReactNode;
  line: string | null;
  trend: readonly (number | null)[];
  className?: string;
}): React.JSX.Element {
  return (
    <a
      href={TAB_HREF[p.tab]}
      className={`card card-border min-w-0 bg-base-100 hover:border-primary ${CARD_LIFT} ${p.className ?? ""}`}
      data-testid={p.testId}
    >
      <div className="card-body gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-2">
          {/* The tile's name is the product's own, not the customer's, so
              it wraps rather than being clamped: three fixed phrases, and a
              name cut in half is a name nobody can read. */}
          <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-base-content/70">
            {p.label}
          </span>
          <span className="flex shrink-0 items-center text-base-content/70">
            <span className="sr-only">{copy(TAB_COPY_KEY[p.tab])}</span>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden className={ARROW_NUDGE} />
          </span>
        </div>

        {p.figure === null ? (
          <p className="text-sm text-base-content/70">{p.line ?? p.label}</p>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              <span className="figure text-4xl leading-none">{p.figure}</span>
              {p.against}
              {p.change}
            </div>
            {p.line === null ? null : <p className="text-xs text-base-content/70">{p.line}</p>}
          </>
        )}

        {/* Drawn at every width: a Recharts series hidden on a phone is a
            chart the layout gate reads as never drawn (#1070). */}
        <TrendSparkline
          points={p.trend}
          label={copy("overview.trend.label", { name: p.label, weeks: formatCount(p.trend.length) })}
          of={p.tab === "rivals" ? "rival" : "you"}
        />
      </div>
    </a>
  );
}

export function LinkedTiles(p: {
  searches: Module<number>;
  /** The searches series, oldest first, for the first tile's trend. */
  searchTrend: readonly (number | null)[];
  pagesPublished: Module<number>;
  aiAnswers: OverviewModel["aiAnswers"];
  rivals: RivalGapModule;
  /** Which engine the AI-answers number is counted from (issue 867), already
   *  written by the caller. */
  engineLine: string | null;
  /** D22 · D19 (#1162): the tracked buyer prompts' window. Once a weekly
   *  pass has asked them, the AI tile is the mention rate. */
  prompts: PromptsModel;
}): React.JSX.Element {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-3" data-testid="overview-tiles">
      <SearchesTile searches={p.searches} pagesPublished={p.pagesPublished} trend={p.searchTrend} />
      {p.prompts.kind === "measured" ? (
        <MentionRateTile prompts={p.prompts} />
      ) : (
        <QuestionsTile aiAnswers={p.aiAnswers} engineLine={p.engineLine} />
      )}
      <RivalsTile rivals={p.rivals} />
    </div>
  );
}

function SearchesTile(p: {
  searches: Module<number>;
  pagesPublished: Module<number>;
  trend: readonly (number | null)[];
}): React.JSX.Element {
  const label = copy(SEARCHES_LABEL);
  const value = renderValue(p.searches.headline.value, SEARCHES_LABEL);
  const carried = carriedBy(p.searches.headline, SEARCHES_LABEL);
  const goal = copy("overview.goal", {
    value: formatCount(GOALS[p.searches.headline.goal].value),
  });
  // The line under the number: how many published pages are already
  // ranking, out of how many were published. Both are stored readings, and
  // the line is absent where either was never taken — never a `0 of 0`.
  const published = renderValue(p.pagesPublished.headline.value, SEARCHES_LABEL);
  const ranking = contextValue(p.pagesPublished);
  const rankingRendered = ranking === null ? null : renderValue(ranking, SEARCHES_LABEL);
  const ranked =
    rankingRendered === null || rankingRendered.isDash || published.isDash
      ? null
      : copy("overview.tile.searches.ranking", {
          ranked: rankingRendered.text,
          published: published.text,
        });

  return (
    <Tile
      label={label}
      tab="search"
      testId="overview-tile-searches"
      figure={value.isDash ? null : value.text}
      against={<Against>{goal}</Against>}
      change={
        carried.kind === "delta" ? <Change markKey={carried.markKey} text={carried.text} /> : null
      }
      line={value.isDash ? (value.line ?? null) : ranked}
      trend={p.trend}
    />
  );
}

function QuestionsTile(p: {
  aiAnswers: OverviewModel["aiAnswers"];
  engineLine: string | null;
}): React.JSX.Element {
  const label = copy(QUESTIONS_LABEL);
  const value = renderValue(p.aiAnswers.headline.value, QUESTIONS_LABEL);
  const of = formatCount(p.aiAnswers.window.of);
  const goal = copy("overview.goal", {
    value: formatCount(GOALS[p.aiAnswers.headline.goal].value),
  });

  return (
    <Tile
      label={label}
      tab="ai_answers"
      testId="overview-tile-questions"
      figure={value.isDash ? null : value.text}
      // The window's denominator and the goal: §4.5's two halves, and no
      // change at all (REQ-041 c12).
      against={
        <Against>
          <span>{copy("overview.tile.ai-answers.of", { of })}</span>
          <span>{goal}</span>
        </Against>
      }
      line={value.isDash ? (value.line ?? null) : p.engineLine}
      trend={presenceTrend(p.aiAnswers.window)}
    />
  );
}

/**
 * D22's first headline number (#1162): answers to the tracked buyer prompts
 * that name or link the site, over the rolling four weeks, with the range
 * the true rate most likely sits in. Under it, share of voice against the
 * rivals and the site's own pages cited. No goal and no change arrow: the
 * range is what says whether a week's move means anything.
 */
function MentionRateTile(p: { prompts: Extract<PromptsModel, { kind: "measured" }> }): React.JSX.Element {
  const { rate, rateShown, firstMeasurement, shareOfVoice, pages } = p.prompts;
  const mentioned = formatCount(rate.linked + rate.named);
  const lines = [
    // D58 (issue 1287): no rate before two weeks of this prompt set. The
    // count and its sample stand in its place.
    rateShown
      ? copy("overview.tile.mention-rate.of", {
          mentioned,
          answers: formatCount(rate.samples),
          weeks: formatCount(ANSWER_RATE_WEEKS),
        })
      : copy(firstMeasurement ? "overview.tile.mention-rate.first" : "overview.tile.mention-rate.early", {
          weeks: formatCount(MENTION_RATE_MIN_WEEKS),
        }),
    shareOfVoice === null
      ? null
      : copy("overview.tile.mention-rate.share", { share: formatCount(percent(shareOfVoice)) }),
    pages.length === 1
      ? copy("overview.tile.mention-rate.pages.one")
      : copy("overview.tile.mention-rate.pages", { pages: formatCount(pages.length) }),
  ].filter((line): line is string => line !== null);

  return (
    <Tile
      label={copy(MENTION_RATE_LABEL)}
      tab="ai_answers"
      testId="overview-tile-mention-rate"
      figure={rateShown ? `${formatCount(percent(rate.rate))}%` : mentioned}
      against={
        <Against>
          {rateShown
            ? copy("overview.tile.mention-rate.band", {
                low: formatCount(percent(rate.low)),
                high: formatCount(percent(rate.high)),
              })
            : copy("overview.tile.mention-rate.early.of", { answers: formatCount(rate.samples) })}
        </Against>
      }
      line={lines.join(" · ")}
      trend={rateShown ? p.prompts.trend : []}
    />
  );
}

/** The AI window as a series: one point per week, `1` where the customer was
 *  named and `0` where they were not. A week nobody measured is `null` — not
 *  a zero, which would draw as a measured absence. */
function presenceTrend(window: AiPresenceWindow): readonly (number | null)[] {
  return window.weeks.map((week) => (week.present === null ? null : week.present ? 1 : 0));
}

function RivalsTile(p: { rivals: RivalGapModule }): React.JSX.Element {
  const label = copy(RIVALS_LABEL);
  // The nearest reachable rival. The rows are already ordered nearest first
  // (`resolveRivals`) and a market leader is never among them, so the head
  // of the list is the lead this tile is about.
  const nearest: AbsoluteRival | RatioRival | undefined = p.rivals.rivals[0];
  if (nearest === undefined) {
    return (
      <Tile
        label={label}
        tab="rivals"
        testId="overview-tile-rivals"
        className="col-span-2 lg:col-span-1"
        figure={null}
        line={noRivalLine(p.rivals)}
        trend={[]}
      />
    );
  }

  const whose = copy("overview.tile.rivals.whose", { rival: nearest.domain });

  if (p.rivals.kind === "absolute") {
    // Cold start (§6.6): the rival's own count beside the customer's, never
    // a ratio — dividing by a zero own count renders as ∞× and reads as
    // broken.
    const count = renderValue(p.rivals.rivals[0]?.ranked ?? p.rivals.own, RIVALS_LABEL);
    const own = renderValue(p.rivals.own, RIVALS_LABEL);
    return (
      <Tile
        label={label}
        tab="rivals"
        testId="overview-tile-rivals"
        className="col-span-2 lg:col-span-1"
        figure={count.isDash ? null : count.text}
        against={
          own.isDash ? null : (
            <Against>
              <span>{copy("overview.rivals.you")}</span>
              <span>{own.text}</span>
            </Against>
          )
        }
        line={whose}
        trend={nearest.series}
      />
    );
  }

  const [first] = p.rivals.rivals;
  const ratio = first === undefined ? null : renderValue(first.ratio, RIVALS_LABEL);
  const was = first === undefined ? null : previousText(first.previous);

  return (
    <Tile
      label={label}
      tab="rivals"
      testId="overview-tile-rivals"
      className="col-span-2 lg:col-span-1"
      figure={ratio === null || ratio.isDash ? null : copy("overview.rivals.ratio", { ratio: ratio.text })}
      against={was === null ? null : <Against>{was}</Against>}
      line={whose}
      trend={nearest.series}
    />
  );
}

/** The line where there is no reachable rival to lead with — every tracked
 *  rival is a market leader, or none was sized at all. */
function noRivalLine(rivals: RivalGapModule): string | null {
  return rivals.leaders.domains.length > 0
    ? copy("overview.rivals.none-reachable")
    : copy(rivals.lineKey);
}

/** The `was 1.5×` badge — none on the first ratio, and none across a change
 *  (the difference either side of one would not be movement). */
function previousText(previous: RatioRival["previous"]): string | null {
  if (previous.kind === "first_ratio" || previous.kind === "spans_change") return null;
  const rendered = renderValue(previous, RIVALS_LABEL);
  if (rendered.isDash) return null;
  return copy("overview.rivals.was", {
    previous: copy("overview.rivals.ratio", { ratio: rendered.text }),
  });
}

/** The first context value a module carries, or `null`. */
function contextValue(module: Module<number>): Measured<number> | null {
  const first = module.context?.[0];
  return first === undefined ? null : (first.value as Measured<number>);
}
