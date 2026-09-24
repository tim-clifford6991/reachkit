// SPEC §1 2026-09-24 (#1067) — the hero's *Inside ReachKit* preview.
// src/app/(public)/_landing/InsideReachKit.tsx
//
// Boards `R12-1-Landing` / `R12-8-Phone-landing`: beside the title and the
// one field, the same height as them, a card that turns through four tabs —
// *Your week · Your score · AI answers · Your page*. It is what Round 11's
// one-week card (#935) held, split into the four things a customer looks
// at, over the same example business; the line under it still says in
// writing that the business is an example.
//
// **Nothing inside a panel is a control.** The tabs are the only buttons;
// the board's *Read it* and *Stop this page* under *Your page* are not
// drawn, because on the landing they would be controls that do nothing
// (SPEC §1, 2026-09-20: "every control on them does something"). The
// autopilot state is a `badge`, not a `toggle`, for the same reason.
//
// **daisyUI classes, the Overview's own Recharts line, no image** (DESIGN
// rules 1 and 2): `card`, `tabs`, `badge`, `stat`, `alert`; the week is
// CSS grid; the score's line is `GrowthLine` through `./HeroLine`, which
// fetches its code only when *Your score* is on screen (#988's budget).
// The deep floating shadow is spent here (`FLOAT`, #1064).
//
// **Every figure is `specimen.ts`'s and every sentence is a key.**
import type React from "react";
import { Clock, MessageSquare, Send, Zap } from "lucide-react";
import { HeroLine } from "./HeroLine";
import { InsideTabs } from "./InsideTabs";
import { copy } from "@/lib/presentation/copy";
import { SCORE_BAND_BOUNDS } from "@/lib/config/constants";
import { FLOAT } from "@/ui/lift";
import { STAGE_BEACON, TONE_DOT } from "@/app/(account)/app/calendar/stages";
import { Num } from "../scan/[domain]/_address/measured";
import {
  SPECIMEN_HERO,
  SPECIMEN_HERO_BLOG,
  SPECIMEN_HERO_BUSINESS,
  SPECIMEN_HERO_CITED,
  SPECIMEN_HERO_DOMAIN,
  SPECIMEN_HERO_DUE,
  SPECIMEN_HERO_SEARCH,
  SPECIMEN_HERO_WEEKS,
  specimenAutopilotSince,
  specimenHeroWeek,
} from "./specimen";

/** Bound to a name before it reaches JSX: the copy sweep reads a bare JSX
 *  attribute string as product voice, and it is right to. */
const HERO_TEST_ID = "landing-inside";

/** `/100`: a numeric format, not a sentence. */
function outOf(max: number): string {
  return `/${max}`;
}

/** The answer takes the width it has and wraps; `min-w-0` so a long line
 *  shortens rather than pushing the card wider. */
const ANSWER = "min-w-0 text-sm";

/**
 * The AI answer, with the example business drawn as the reader's own.
 *
 * The sentence is one key and is resolved whole; this splits the resolved
 * string on the name it was just given, so the emphasis is a *rendering*
 * of that one sentence and never a second copy of it. A name that somehow
 * does not appear leaves the sentence intact and unemphasised.
 */
function AiAnswer(): React.JSX.Element {
  const sentence = copy("landing.hero.ai.answer", { you: SPECIMEN_HERO_BUSINESS });
  const at = sentence.indexOf(SPECIMEN_HERO_BUSINESS);
  if (at < 0) return <p className={ANSWER}>{sentence}</p>;
  return (
    <p className={ANSWER}>
      {sentence.slice(0, at)}
      <strong className="text-primary font-bold">{SPECIMEN_HERO_BUSINESS}</strong>
      {sentence.slice(at + SPECIMEN_HERO_BUSINESS.length)}
    </p>
  );
}

/** One day of the week. Monday measures, so it carries the week's two
 *  counts on the accent ground; the five that publish each carry one page
 *  title and the hour it went live. The title wraps and the cell grows with
 *  it — a clamp is a box that clips, which the layout gate reports (#935). */
function DayCell(p: { weekday: string; title: string | null }): React.JSX.Element {
  return (
    <li
      className={`rounded-box flex min-w-0 flex-col gap-1 p-2 ${
        p.title === null ? "bg-primary/10 text-primary" : "bg-base-200"
      }`}
    >
      <span className="num text-xs font-bold uppercase">{p.weekday}</span>
      {p.title === null ? (
        <span className="text-xs font-semibold leading-tight">
          {copy("landing.hero.week.measured", {
            searches: String(SPECIMEN_HERO.searches),
            questions: String(SPECIMEN_HERO.questions),
          })}
        </span>
      ) : (
        <>
          <span className="min-w-0 text-xs font-semibold leading-tight">{p.title}</span>
          <span className="badge badge-success badge-sm mt-auto gap-1">
            {copy("calendar.stage.live")}
            <Num>{SPECIMEN_HERO.liveAt}</Num>
          </span>
        </>
      )}
    </li>
  );
}

/** *Your week*: autopilot, the six days, and who does what. */
function WeekPanel(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="badge badge-success gap-1">
          <Zap size={16} strokeWidth={1.75} aria-hidden />
          {copy("landing.hero.autopilot", { since: specimenAutopilotSince() })}
        </span>
        <span className="text-base-content/70 text-xs">
          <Num>{SPECIMEN_HERO_DOMAIN}</Num>
        </span>
      </div>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label={copy("overview.week.title")}>
        {specimenHeroWeek().map((day) => (
          <DayCell key={day.weekday} weekday={day.weekday} title={day.page === null ? null : copy(day.page)} />
        ))}
      </ol>
      <div className="divider my-0" />
      <div className="flex flex-col gap-2">
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Clock size={16} strokeWidth={1.75} className="text-primary shrink-0" aria-hidden />
          {copy("landing.hero.work.you")}
        </p>
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Send size={16} strokeWidth={1.75} className="text-primary shrink-0" aria-hidden />
          {copy("landing.hero.work.reachkit")}
        </p>
      </div>
    </div>
  );
}

/** *Your score*: the number the week left, and the line it moved along to
 *  the `findable` boundary — the product's own threshold and word. */
function ScorePanel(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="stat p-0">
        <div className="stat-title">{copy("overview.tile.score.label")}</div>
        {/* A flex row, so the mono denominator has a box of its own (#935). */}
        <div className="stat-value flex items-baseline gap-2 text-5xl">
          <Num figure>{SPECIMEN_HERO.score}</Num>
          <span className="text-base-content/60 text-base">
            <Num>{outOf(SPECIMEN_HERO.max)}</Num>
          </span>
          <span className="badge badge-success badge-sm self-center">
            <Num>{copy("overview.delta.up")}</Num>
            <Num>{SPECIMEN_HERO.delta}</Num>
          </span>
        </div>
      </div>
      <HeroLine
        weeks={SPECIMEN_HERO_WEEKS}
        label={copy("overview.tile.score.label")}
        target={{
          value: SCORE_BAND_BOUNDS.findable,
          label: `${copy("band.score.findable")} · ${SCORE_BAND_BOUNDS.findable}`,
        }}
      />
      <p className="text-base-content/70 text-sm">{copy("landing.hero.week.line")}</p>
    </div>
  );
}

/** *AI answers*: what the engine says to the search now, and whom it cites. */
function AnswersPanel(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <MessageSquare size={16} strokeWidth={1.75} className="text-primary shrink-0" aria-hidden />
        {copy("landing.inside.answers.head")}
      </p>
      <p className="text-base-content/70 text-xs">
        <Num phrase>{SPECIMEN_HERO_SEARCH}</Num>
      </p>
      <div className="alert items-start">
        <AiAnswer />
      </div>
      <ul className="flex flex-wrap gap-2">
        {SPECIMEN_HERO_CITED.map((site) => (
          <li key={site} className="badge badge-ghost badge-sm">
            <Num>{site}</Num>
          </li>
        ))}
      </ul>
      <p className="text-base-content/70 text-sm">{copy("landing.inside.answers.monday")}</p>
    </div>
  );
}

/** *Your page*: the page waiting a day for the owner's read. */
function PagePanel(): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="badge badge-soft badge-primary gap-1.5">
          <span className={`size-1.5 shrink-0 rounded-full ${TONE_DOT.accent} ${STAGE_BEACON.your_review}`} aria-hidden />
          {copy("calendar.stage.your-review")}
        </span>
        <span className="text-base-content/70 text-sm">
          {copy("landing.inside.page.due", { in: SPECIMEN_HERO_DUE })}
        </span>
      </div>
      <div className="rounded-box bg-base-200 flex min-w-0 flex-col gap-2 p-4">
        <span className="text-base-content/70 text-xs">
          <Num>{SPECIMEN_HERO_BLOG}</Num>
        </span>
        <p className="text-lg font-semibold">{copy("landing.hero.page.1")}</p>
        <p className="text-base-content/70 text-sm">
          <strong className="text-base-content mr-1 font-semibold">{copy("landing.inside.page.why.label")}</strong>
          {copy("landing.inside.page.why.body")}
        </p>
      </div>
    </div>
  );
}

export function InsideReachKit(): React.JSX.Element {
  return (
    <div className={`card bg-base-100 h-full min-w-0 ${FLOAT}`} data-testid={HERO_TEST_ID}>
      <div className="card-body gap-4">
        <InsideTabs
          title={copy("landing.inside.title")}
          tabs={[
            { label: copy("landing.inside.tab.week"), panel: <WeekPanel /> },
            { label: copy("landing.inside.tab.score"), panel: <ScorePanel /> },
            { label: copy("landing.inside.tab.answers"), panel: <AnswersPanel /> },
            { label: copy("landing.inside.tab.page"), panel: <PagePanel /> },
          ]}
        />
        <p className="text-base-content/70 mt-auto text-xs">{copy("landing.hero.example")}</p>
      </div>
    </div>
  );
}
