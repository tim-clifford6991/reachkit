// SPEC §4 (2026-10-02, D22 · 2026-10-07, issue 1319) — the headline numbers,
// each one a door.
//
// D22's four, in its order: the AI mention rate, the site's own pages
// cited, the written pages Google places in its top 20, and AI visits to a
// hosted blog. Each opens the screen that already holds its detail.
//
// Each tile is an `<a>`, not a card with a link inside it: the whole box is
// the control, and a nested control inside a link is not something a
// keyboard can reach twice.
//
// **A tile holds a number and what it is read against.** No goal (D23), no
// Discoverability Score (D22), no rival's lead (D24), and no sentence that
// only says the number again. The one line a tile may carry is a second
// fact: share of voice, the engine counted from, the people who arrived.
//
// **A number nobody has is not drawn as a tile.** Pages cited exists once a
// weekly pass has asked the buyer prompts; AI visits exists on a hosted
// blog with a page live. Before the prompts are asked, the first tile is
// the tracked questions' reading (D22: "until D19 takes effect").
//
// **It cannot overflow.** Two columns below `lg` and one row above it; every
// tile is `min-w-0`, its name wraps inside its own column and its figure is
// never clamped — the box changes instead (docs/DESIGN.md's no-overflow
// rule).
import type React from "react";
import { ChevronRight } from "lucide-react";
import { TrendSparkline } from "@/ui/charts";
import { ARROW_NUDGE, CARD_LIFT } from "@/ui/lift";
import { copy, type CopyKey } from "@/lib/presentation/copy";
import { formatCount, renderValue } from "./present";
import type { AiPresenceWindow, OverviewModel } from "./model";
import { TAB_COPY_KEY, TAB_HREF, type OverviewTab } from "./tabs";
import { ANSWER_RATE_WEEKS, MENTION_RATE_MIN_WEEKS } from "@/lib/config/constants";
import { percent, type PromptsModel } from "./prompts-model";
import type { Measured } from "@/lib/measure/measured";
import type { BlogReadsModel } from "./blog-reads-model";

const QUESTIONS_LABEL = "overview.tile.questions.label" satisfies CopyKey;
const MENTION_RATE_LABEL = "overview.tile.mention-rate.label" satisfies CopyKey;
const PAGES_CITED_LABEL = "overview.tile.pages-cited.label" satisfies CopyKey;
const TOP_20_LABEL = "overview.tile.top-20.label" satisfies CopyKey;
const AI_VISITS_LABEL = "overview.tile.ai-visits.label" satisfies CopyKey;

export interface Top20 {
  value: Measured<number>;
  of: Measured<number>;
}

/** What a tile is read against, drawn bare beside the number: the range,
 *  the sample, the denominator, the window. A count with words, so it is
 *  `num-phrase` and folds between them: `.num` alone never wraps, and in a
 *  phone's half-width tile "in AI answers, last 4 weeks" stood 82px out of
 *  its row (the fourth gate, on this issue's first push). */
function Against(p: { children: React.ReactNode }): React.JSX.Element {
  return <span className="num num-phrase min-w-0 text-sm text-base-content/70">{p.children}</span>;
}

/** One tile. The head names it and the tab it opens; the figure row holds
 *  the number and what it is read against; under them at most one line and,
 *  where the reading has a series, its trend. A tile whose reading was
 *  never taken shows the written line where the number would stand. */
function Tile(p: {
  label: string;
  tab: OverviewTab;
  testId: string;
  /** `null` where the reading was not taken. */
  figure: string | null;
  /** A word that stands before the figure ("at least"). */
  before?: string;
  against?: React.ReactNode;
  line?: string | null;
  trend?: readonly (number | null)[];
}): React.JSX.Element {
  const line = p.line ?? null;
  return (
    <a
      href={TAB_HREF[p.tab]}
      className={`card card-border min-w-0 bg-base-100 hover:border-primary ${CARD_LIFT}`}
      data-testid={p.testId}
    >
      <div className="card-body gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-2">
          {/* The tile's name is the product's own, not the customer's, so
              it wraps rather than being clamped: a name cut in half is a
              name nobody can read. */}
          <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-base-content/70">
            {p.label}
          </span>
          <span className="flex shrink-0 items-center text-base-content/70">
            <span className="sr-only">{copy(TAB_COPY_KEY[p.tab])}</span>
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden className={ARROW_NUDGE} />
          </span>
        </div>

        {p.figure === null ? (
          <p className="text-sm text-base-content/70">{line ?? p.label}</p>
        ) : (
          <>
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              {p.before === undefined ? null : <span className="text-sm text-base-content/70">{p.before}</span>}
              <span className="figure text-4xl leading-none">{p.figure}</span>
              {p.against}
            </div>
            {line === null ? null : <p className="text-xs text-base-content/70">{line}</p>}
          </>
        )}

        {p.trend === undefined ? null : (
          <TrendSparkline
            points={p.trend}
            label={copy("overview.trend.label", { name: p.label, weeks: formatCount(p.trend.length) })}
          />
        )}
      </div>
    </a>
  );
}

export function LinkedTiles(p: {
  aiAnswers: OverviewModel["aiAnswers"];
  /** Which engine the tracked questions' number is counted from (issue
   *  867), already written by the caller. */
  engineLine: string | null;
  /** D22 · D19 (#1162): the tracked buyer prompts' window. Once a weekly
   *  pass has asked them, the first tile is the mention rate and the second
   *  is the pages those answers cited. */
  prompts: PromptsModel;
  /** The live pages Google places in its top 20, out of the live pages —
   *  the Search tab's own reading, declared by shape so this file does not
   *  import that tab's model. */
  top20: Top20;
  blogReads: BlogReadsModel;
}): React.JSX.Element {
  const tiles = [
    p.prompts.kind === "measured" ? (
      <MentionRateTile key="rate" prompts={p.prompts} />
    ) : (
      <QuestionsTile key="questions" aiAnswers={p.aiAnswers} engineLine={p.engineLine} />
    ),
    p.prompts.kind === "measured" ? <PagesCitedTile key="cited" pages={p.prompts.pages.length} /> : null,
    <Top20Tile key="top-20" tile={p.top20} />,
    p.blogReads.show ? <AiVisitsTile key="visits" model={p.blogReads} /> : null,
  ].filter((tile) => tile !== null);

  return (
    <div
      className={`grid min-w-0 grid-cols-2 gap-3 ${tiles.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
      data-testid="overview-tiles"
    >
      {tiles}
    </div>
  );
}

function QuestionsTile(p: {
  aiAnswers: OverviewModel["aiAnswers"];
  engineLine: string | null;
}): React.JSX.Element {
  const label = copy(QUESTIONS_LABEL);
  const value = renderValue(p.aiAnswers.headline.value, QUESTIONS_LABEL);
  const of = formatCount(p.aiAnswers.window.of);

  return (
    <Tile
      label={label}
      tab="ai_answers"
      testId="overview-tile-questions"
      figure={value.isDash ? null : value.text}
      // The window's denominator, and no change at all (REQ-041 c12).
      against={<Against>{copy("overview.tile.ai-answers.of", { of })}</Against>}
      line={value.isDash ? (value.line ?? null) : p.engineLine}
      trend={presenceTrend(p.aiAnswers.window)}
    />
  );
}

/**
 * D22's first headline number (#1162): answers to the tracked buyer prompts
 * that name or link the site, over the rolling four weeks, with the range
 * the true rate most likely sits in. Under it, share of voice against the
 * rivals. No goal and no change arrow: the range is what says whether a
 * week's move means anything.
 */
function MentionRateTile(p: { prompts: Extract<PromptsModel, { kind: "measured" }> }): React.JSX.Element {
  const { rate, rateShown, firstMeasurement, shareOfVoice } = p.prompts;
  const mentioned = formatCount(rate.linked + rate.named);
  // D58 (issue 1287): no rate before two weeks of this prompt set. The
  // count and its sample stand in its place, and the line says when the
  // rate appears.
  const line = !rateShown
    ? copy(firstMeasurement ? "overview.tile.mention-rate.first" : "overview.tile.mention-rate.early", {
        weeks: formatCount(MENTION_RATE_MIN_WEEKS),
      })
    : shareOfVoice === null
      ? null
      : copy("overview.tile.mention-rate.share", { share: formatCount(percent(shareOfVoice)) });

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
      line={line}
      trend={rateShown ? p.prompts.trend : []}
    />
  );
}

/** D22's second: the site's own pages an AI answer cited in the window.
 *  The pages themselves, each with its answers, are on the AI answers tab. */
function PagesCitedTile(p: { pages: number }): React.JSX.Element {
  return (
    <Tile
      label={copy(PAGES_CITED_LABEL)}
      tab="ai_answers"
      testId="overview-tile-pages-cited"
      figure={formatCount(p.pages)}
      against={<Against>{copy("overview.tile.pages-cited.window", { weeks: formatCount(ANSWER_RATE_WEEKS) })}</Against>}
    />
  );
}

/** D22's third: live pages whose search the site holds a top-20 place for,
 *  out of the live pages. Each page's own place is on the Search tab. */
function Top20Tile(p: { tile: Top20 }): React.JSX.Element {
  const value = renderValue(p.tile.value, TOP_20_LABEL);
  const of = renderValue(p.tile.of, TOP_20_LABEL);
  return (
    <Tile
      label={copy(TOP_20_LABEL)}
      tab="search"
      testId="overview-tile-top-20"
      figure={value.isDash ? null : value.text}
      against={of.isDash ? null : <Against>{copy("overview.search.tile.pages.of", { of: of.text })}</Against>}
      line={value.isDash ? (value.line ?? null) : null}
    />
  );
}

/** D22's fourth, on a hosted blog: pages an answer engine fetched, as "at
 *  least", and under it the people who arrived from an answer. Two
 *  measures, never added together (`blog-reads-model.ts`). */
function AiVisitsTile(p: { model: BlogReadsModel }): React.JSX.Element {
  const fetches = renderValue(p.model.fetches, AI_VISITS_LABEL);
  const referrals = renderValue(p.model.referrals, AI_VISITS_LABEL);
  return (
    <Tile
      label={copy(AI_VISITS_LABEL)}
      tab="ai_answers"
      testId="overview-tile-ai-visits"
      figure={fetches.isDash ? null : fetches.text}
      before={copy("overview.tile.ai-visits.at-least")}
      against={<Against>{copy("overview.tile.ai-visits.window", { days: formatCount(p.model.windowDays) })}</Against>}
      line={
        fetches.isDash
          ? (fetches.line ?? null)
          : referrals.isDash
            ? null
            : copy("overview.tile.ai-visits.referrals", { visitors: referrals.text })
      }
    />
  );
}

/** The AI window as a series: one point per week, `1` where the customer was
 *  named and `0` where they were not. A week nobody measured is `null` — not
 *  a zero, which would draw as a measured absence. */
function presenceTrend(window: AiPresenceWindow): readonly (number | null)[] {
  return window.weeks.map((week) => (week.present === null ? null : week.present ? 1 : 0));
}
